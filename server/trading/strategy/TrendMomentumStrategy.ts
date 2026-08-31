import type { MarketSnapshot, StrategySignal } from "../types.js";
import { riskReward } from "../../market/TechnicalAnalysis.js";

function longOk(h1: MarketSnapshot, m5: MarketSnapshot): boolean {
  return (
    h1.ema20 > h1.ema50 &&
    h1.price > h1.ema200 &&
    m5.rsi > 45 &&
    m5.rsi < 70 &&
    (m5.macdSignal === "BULLISH_CROSS" || h1.trend === "BULLISH") &&
    m5.volatility !== "EXTREME"
  );
}

function shortOk(h1: MarketSnapshot, m5: MarketSnapshot): boolean {
  return (
    h1.ema20 < h1.ema50 &&
    h1.price < h1.ema200 &&
    m5.rsi < 55 &&
    m5.rsi > 30 &&
    (m5.macdSignal === "BEARISH_CROSS" || h1.trend === "BEARISH") &&
    m5.volatility !== "EXTREME"
  );
}

export function evaluateTrendMomentum(h1: MarketSnapshot, m15: MarketSnapshot, m5: MarketSnapshot): StrategySignal | null {
  const atr = m5.atr || h1.price * 0.01;
  if (longOk(h1, m5)) {
    const entry = m5.price;
    const sl = Number((entry - atr * 1.5).toFixed(4));
    const tp = Number((entry + atr * 3).toFixed(4));
    const rr = riskReward(entry, sl, tp);
    const confidence = Math.min(90, Math.round(62 + (h1.ema20 - h1.ema50) / entry * 2000 + (m15.trend === "BULLISH" ? 8 : 0)));
    return {
      symbol: h1.symbol,
      direction: "LONG",
      confidence,
      entryPrice: entry,
      stopLoss: sl,
      takeProfit: tp,
      riskReward: rr,
      reasoning: `Trend+Momentum LONG: EMA20>EMA50, цена выше EMA200, RSI ${m5.rsi}, MACD ${m5.macdSignal}. RR ${rr}`,
      strategy: "TREND_MOMENTUM",
    };
  }
  if (shortOk(h1, m5)) {
    const entry = m5.price;
    const sl = Number((entry + atr * 1.5).toFixed(4));
    const tp = Number((entry - atr * 3).toFixed(4));
    const rr = riskReward(entry, sl, tp);
    const confidence = Math.min(90, Math.round(62 + (h1.ema50 - h1.ema20) / entry * 2000 + (m15.trend === "BEARISH" ? 8 : 0)));
    return {
      symbol: h1.symbol,
      direction: "SHORT",
      confidence,
      entryPrice: entry,
      stopLoss: sl,
      takeProfit: tp,
      riskReward: rr,
      reasoning: `Trend+Momentum SHORT: EMA20<EMA50, цена ниже EMA200, RSI ${m5.rsi}. RR ${rr}`,
      strategy: "TREND_MOMENTUM",
    };
  }
  return null;
}
