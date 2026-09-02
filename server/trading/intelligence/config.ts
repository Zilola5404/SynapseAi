/** Configurable thresholds. Not win-rate claims. */
export const INTEL = {
  minRr: 2,
  minConfluenceTrade: 10,
  minConfluenceAuto: 13,
  confluenceMax: 15,
  rvolWeak: 0.8,
  rvolNormal: 1.2,
  rvolStrong: 2,
  equalLevelPct: 0.15,
  sweepWickAtr: 0.2,
  adxTrend: 25,
  adxRange: 20,
  atrExtremePct: 4,
  atrHighPct: 2.5,
  scaleOut: [0.3, 0.3, 0.4] as const,
  consecutiveLossLimit: 3,
  consecutiveLossPauseMs: 60 * 60 * 1000,
} as const;

export const SCAN_UNIVERSE = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "ADAUSDT",
] as const;
