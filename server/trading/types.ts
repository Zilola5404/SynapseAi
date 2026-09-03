import { SCAN_UNIVERSE } from "./intelligence/config.js";

export const SCAN_SYMBOLS = SCAN_UNIVERSE;
export type ScanSymbol = (typeof SCAN_SYMBOLS)[number];
export type TradeSide = "LONG" | "SHORT";
export type TradingMode = "PAPER" | "TESTNET" | "LIVE";
export type SignalStatus = "NEW" | "FILTERED" | "REJECTED" | "APPROVED" | "EXECUTED";

export interface MarketSnapshot {
  symbol: string;
  price: number;
  trend: "BULLISH" | "BEARISH" | "NEUTRAL";
  rsi: number;
  ema20: number;
  ema50: number;
  ema200: number;
  macdSignal: "BULLISH_CROSS" | "BEARISH_CROSS" | "NEUTRAL";
  atr: number;
  volatility: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  timeframe: string;
  volume?: number;
  avgVolume?: number;
  relativeVolume?: number;
  structure?: "BULLISH" | "BEARISH" | "RANGE";
  regime?: "TRENDING" | "RANGING" | "HIGH_VOLATILITY" | "LOW_VOLATILITY";
  lastSwingHigh?: number;
  lastSwingLow?: number;
  nearestSupport?: number;
  nearestResistance?: number;
}

export type ScoreLine = {
  key: string;
  points: number;
  max: number;
  ok: boolean;
  textRu: string;
  textEn: string;
};

export interface StrategySignal {
  symbol: string;
  direction: TradeSide;
  /** Confluence 0–15 stored here for DB compat. Not a win probability. */
  confidence: number;
  qualityScore: number;
  confluenceScore?: number;
  setupGrade?: "A+" | "A" | "B";
  setupType?: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  takeProfit1?: number;
  takeProfit2?: number;
  takeProfit3?: number | null;
  invalidation?: string;
  riskReward: number;
  reasoning: string;
  strategy: string;
  scoreLines?: ScoreLine[];
  marketRegime?: string;
  structure?: string;
}

import type { SizeBreakdown } from "./risk/PositionSizer.js";

export interface RiskDecision {
  allowed: boolean;
  reason?: string;
  code?: string;
  quantity: number;
  sizeUsdt: number;
  marginUsdt: number;
  leverage: number;
  explain?: SizeBreakdown;
  cost?: import("./risk/tradeCostGate.js").TradeCostEstimate;
}

export interface OpenPositionInput {
  userId: string;
  symbol: string;
  side: TradeSide;
  entryPrice: number;
  quantity: number;
  stopLoss: number;
  takeProfit: number;
  leverage: number;
  rationale: string;
  confidence: number;
  mode: TradingMode;
}
