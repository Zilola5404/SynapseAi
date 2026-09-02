export type GradedTrade = {
  grade: "A+" | "A" | "B" | string;
  pnl: number;
  fees: number;
  rMultiple?: number;
};

export type GradeStats = {
  grade: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  expectancy: number;
  maxDrawdown: number;
  averageR: number;
  netPnl: number;
  fees: number;
};

function emptyStats(grade: string): GradeStats {
  return {
    grade,
    trades: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    avgWin: 0,
    avgLoss: 0,
    profitFactor: 0,
    expectancy: 0,
    maxDrawdown: 0,
    averageR: 0,
    netPnl: 0,
    fees: 0,
  };
}

export function summarizeGrade(grade: string, trades: GradedTrade[]): GradeStats {
  const rows = trades.filter((t) => t.grade === grade);
  const out = emptyStats(grade);
  out.trades = rows.length;
  if (!rows.length) return out;
  const wins = rows.filter((t) => t.pnl > 0);
  const losses = rows.filter((t) => t.pnl < 0);
  out.wins = wins.length;
  out.losses = losses.length;
  out.winRate = rows.length ? wins.length / rows.length : 0;
  out.avgWin = wins.length ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
  out.avgLoss = losses.length ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : 0;
  const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  out.profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;
  out.netPnl = rows.reduce((s, t) => s + t.pnl, 0);
  out.fees = rows.reduce((s, t) => s + (t.fees || 0), 0);
  out.expectancy = out.netPnl / rows.length;
  const rs = rows.map((t) => t.rMultiple).filter((n): n is number => Number.isFinite(n));
  out.averageR = rs.length ? rs.reduce((s, n) => s + n, 0) / rs.length : 0;
  let peak = 0;
  let eq = 0;
  let maxDd = 0;
  for (const t of rows) {
    eq += t.pnl;
    peak = Math.max(peak, eq);
    maxDd = Math.min(maxDd, eq - peak);
  }
  out.maxDrawdown = maxDd;
  return out;
}

export function summarizeStrategyValidation(trades: GradedTrade[]) {
  return {
    "A+": summarizeGrade("A+", trades),
    A: summarizeGrade("A", trades),
    B: summarizeGrade("B", trades),
    sampleTooSmall: trades.filter((t) => t.grade === "A+" || t.grade === "A").length < 30,
  };
}
