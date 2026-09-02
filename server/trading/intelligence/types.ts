import type { MarketSnapshot, TradeSide } from "../types.js";

export type BtcTrend = "BULLISH" | "BEARISH" | "NEUTRAL";
export type VolBucket = "LOW" | "NORMAL" | "HIGH" | "EXTREME";
export type MarketMode = "RISK_ON" | "NEUTRAL" | "RISK_OFF";
export type StructureState = "BULLISH" | "BEARISH" | "RANGE" | "TRANSITION";
export type RegimeState = "TRENDING" | "RANGING" | "HIGH_VOLATILITY" | "EXTREME_VOLATILITY";
export type SetupType = "TREND_PULLBACK" | "BREAKOUT_RETEST" | "NONE";
export type SetupGrade = "A+" | "A" | "B" | "NO_TRADE";
export type VolumeClass = "WEAK" | "NORMAL" | "STRONG" | "VERY_STRONG" | "UNKNOWN";

export type Reason = { textRu: string; textEn: string; ok?: boolean };

export type MarketContext = {
  btcTrend1D: BtcTrend;
  btcTrend4H: BtcTrend;
  btcTrend1H: BtcTrend;
  volatility: VolBucket;
  marketMode: MarketMode;
  score: number;
  reasons: Reason[];
  blockAltLong: boolean;
};

export type MultiTimeframeAnalysis = {
  daily: MarketSnapshot | null;
  h4: MarketSnapshot | null;
  h1: MarketSnapshot | null;
  m15: MarketSnapshot | null;
  m5: MarketSnapshot | null;
  mainTrend: BtcTrend;
  confirmOk: boolean;
  reasons: Reason[];
};

export type StructureResult = {
  structure: StructureState;
  lastSwingHigh: number;
  lastSwingLow: number;
  bos: "BULLISH" | "BEARISH" | "NONE";
  choch: "BULLISH" | "BEARISH" | "NONE";
  reasons: Reason[];
};

export type LevelsResult = {
  majorSupport: number;
  majorResistance: number;
  nearestSupport: number;
  nearestResistance: number;
  roomForLong: boolean;
  roomForShort: boolean;
  reasons: Reason[];
};

export type LiquidityResult = {
  equalHighs: boolean;
  equalLows: boolean;
  previousHigh: number;
  previousLow: number;
  sweep: "HIGH" | "LOW" | "NONE";
  confirmed: boolean;
  score: number;
  reasons: Reason[];
};

export type VolumeResult = {
  current: number;
  average: number;
  relative: number;
  klass: VolumeClass;
  confirms: boolean;
  reasons: Reason[];
};

export type RegimeResult = {
  regime: RegimeState;
  adx: number;
  atrPct: number;
  noNewTrades: boolean;
  reasons: Reason[];
};

export type SetupCandidate = {
  type: SetupType;
  direction: TradeSide;
  reasons: Reason[];
};

export type ConfluenceLine = {
  key: string;
  points: number;
  max: number;
  ok: boolean;
  textRu: string;
  textEn: string;
};

export type ConfluenceResult = {
  total: number;
  max: number;
  grade: SetupGrade;
  lines: ConfluenceLine[];
};

export type TradePlan = {
  symbol: string;
  direction: TradeSide;
  setupType: SetupType;
  setupScore: number;
  grade: SetupGrade;
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number | null;
  riskReward: number;
  invalidation: string;
  reasons: Reason[];
};

export type IntelligenceDecision = {
  decision: "TRADE" | "NO_TRADE";
  plan: TradePlan | null;
  confluence: ConfluenceResult;
  vetoes: Reason[];
  context: MarketContext;
  regime: RegimeResult;
  setup: SetupCandidate | null;
};
