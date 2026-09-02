/** Backtest harness only. Does not change Trading Intelligence or confluence weights. */
export const BACKTEST = {
  historyMonths: 18,
  lookback: 500,
  step: 6,
  /** 24h on 5m. Live engine has no TIME kill; this is a documented sim cap. */
  maxHoldBars: 288,
  trainDays: 182,
  valDays: 61,
  oosDays: 61,
  shiftDays: 61,
  minGradeSample: 30,
  minOosTrades: 30,
  minHistoryDays: 180,
  minWalkForwardWindows: 2,
  equity: 10_000,
  riskPct: 0.005,
  sameBarRule: "WORST_CASE_SL" as const,
  entryRule: "NEXT_BAR_OPEN_PLUS_SLIPPAGE" as const,
};

export const DAY_MS = 86_400_000;
export const INTERVAL_MS: Record<string, number> = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
};
