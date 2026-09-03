/** Backtest harness only. Does not change Trading Intelligence or confluence weights. */
export const BACKTEST = {
  historyMonths: 18,
  lookback: 500,
  step: 6,
  /** Live has no TIME kill. Canonical after exit-sensitivity: NO_TIME_EXIT. */
  maxHoldBars: 1_000_000,
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
  /** Bars beyond this are treated as no time cap. */
  uncappedHoldBars: 1_000_000,
};

export const EXIT_HOLD_VARIANTS: { label: string; hours: number | null; bars: number }[] = [
  { label: "NO_TIME_EXIT", hours: null, bars: 1_000_000 },
  { label: "12h", hours: 12, bars: 144 },
  { label: "24h", hours: 24, bars: 288 },
  { label: "48h", hours: 48, bars: 576 },
  { label: "72h", hours: 72, bars: 864 },
];

export const DAY_MS = 86_400_000;
export const INTERVAL_MS: Record<string, number> = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
};
