export const SCAN_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"] as const;
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
}

export interface StrategySignal {
  symbol: string;
  direction: TradeSide;
  confidence: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
  reasoning: string;
  strategy: string;
}

import type { SizeBreakdown } from "./risk/PositionSizer.js";

export interface RiskDecision {
  allowed: boolean;
  reason?: string;
  quantity: number;
  sizeUsdt: number;
  marginUsdt: number;
  leverage: number;
  explain?: SizeBreakdown;
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
