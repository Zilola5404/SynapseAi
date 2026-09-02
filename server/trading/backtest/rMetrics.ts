import { BACKTEST } from "./config.js";

export type RTrade = {
  resultR: number;
  pnl: number;
  grade?: string;
  exitReason?: string;
};

export type RMetrics = {
  trades: number;
  totalR: number;
  averageR: number;
  expectancyR: number;
  medianR: number;
  winRate: number;
  profitFactor: number;
  maxDrawdownR: number;
  maxConsecutiveLosses: number;
  averageWinR: number;
  averageLossR: number;
  netUsdt: number;
};

export type SampleGate = {
  aPlus: number;
  a: number;
  oos: number;
  historyDays: number;
  walkForwardWindows: number;
  issues: string[];
  sampleLabel: "SAMPLE_OK" | "INSUFFICIENT_SAMPLE" | "OOS_NOT_VALIDATED" | "HISTORY_TOO_SHORT";
  /** Never true from a single outlier USDT print. */
  strategyPass: boolean;
};

function median(xs: number[]) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function computeRMetrics(trades: RTrade[]): RMetrics {
  const rs = trades.map((t) => t.resultR).filter((n) => Number.isFinite(n));
  const empty: RMetrics = {
    trades: trades.length,
    totalR: 0,
    averageR: 0,
    expectancyR: 0,
    medianR: 0,
    winRate: 0,
    profitFactor: 0,
    maxDrawdownR: 0,
    maxConsecutiveLosses: 0,
    averageWinR: 0,
    averageLossR: 0,
    netUsdt: trades.reduce((s, t) => s + (t.pnl || 0), 0),
  };
  if (!rs.length) return empty;
  const wins = rs.filter((r) => r > 0);
  const losses = rs.filter((r) => r < 0);
  const grossWin = wins.reduce((s, r) => s + r, 0);
  const grossLoss = Math.abs(losses.reduce((s, r) => s + r, 0));
  let peak = 0;
  let eq = 0;
  let maxDd = 0;
  let streak = 0;
  let maxStreak = 0;
  for (const r of rs) {
    eq += r;
    peak = Math.max(peak, eq);
    maxDd = Math.min(maxDd, eq - peak);
    if (r < 0) {
      streak += 1;
      maxStreak = Math.max(maxStreak, streak);
    } else streak = 0;
  }
  const avg = rs.reduce((s, r) => s + r, 0) / rs.length;
  return {
    trades: trades.length,
    totalR: rs.reduce((s, r) => s + r, 0),
    averageR: avg,
    expectancyR: avg,
    medianR: median(rs),
    winRate: wins.length / rs.length,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
    maxDrawdownR: maxDd,
    maxConsecutiveLosses: maxStreak,
    averageWinR: wins.length ? grossWin / wins.length : 0,
    averageLossR: losses.length ? losses.reduce((s, r) => s + r, 0) / losses.length : 0,
    netUsdt: trades.reduce((s, t) => s + (t.pnl || 0), 0),
  };
}

export function evaluateSampleGate(params: {
  aPlus: number;
  a: number;
  oos: number;
  historyDays: number;
  walkForwardWindows: number;
  oosExpectancyR: number;
  positiveOosWindows: number;
}): SampleGate {
  const issues: string[] = [];
  if (params.historyDays < BACKTEST.minHistoryDays) issues.push("HISTORY_TOO_SHORT");
  if (params.aPlus < BACKTEST.minGradeSample) issues.push("A+_INSUFFICIENT_SAMPLE");
  if (params.a < BACKTEST.minGradeSample) issues.push("A_INSUFFICIENT_SAMPLE");
  if (params.oos < BACKTEST.minOosTrades) issues.push("OOS_NOT_VALIDATED");
  if (params.walkForwardWindows < BACKTEST.minWalkForwardWindows) issues.push("WALK_FORWARD_TOO_FEW_WINDOWS");
  if (params.oos >= BACKTEST.minOosTrades && params.oosExpectancyR <= 0) issues.push("OOS_EXPECTANCY_R_NOT_POSITIVE");
  if (params.walkForwardWindows >= BACKTEST.minWalkForwardWindows && params.positiveOosWindows < Math.ceil(params.walkForwardWindows / 2)) {
    issues.push("WALK_FORWARD_OOS_NOT_STABLE");
  }

  let sampleLabel: SampleGate["sampleLabel"] = "SAMPLE_OK";
  if (params.historyDays < BACKTEST.minHistoryDays) sampleLabel = "HISTORY_TOO_SHORT";
  else if (params.aPlus < BACKTEST.minGradeSample || params.a < BACKTEST.minGradeSample) sampleLabel = "INSUFFICIENT_SAMPLE";
  else if (params.oos < BACKTEST.minOosTrades) sampleLabel = "OOS_NOT_VALIDATED";

  const strategyPass = issues.length === 0 && params.oosExpectancyR > 0;
  return {
    aPlus: params.aPlus,
    a: params.a,
    oos: params.oos,
    historyDays: params.historyDays,
    walkForwardWindows: params.walkForwardWindows,
    issues,
    sampleLabel,
    strategyPass,
  };
}

export function fmtR(n: number) {
  if (!Number.isFinite(n)) return "n/a";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(3)}R`;
}
