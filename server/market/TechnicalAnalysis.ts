import type { BinanceCandle } from "../binance.js";
import { calculateIndicators } from "../binance.js";
import type { MarketSnapshot } from "../trading/types.js";

function ema(values: number[], period: number): number {
  if (values.length === 0) return 0;
  const k = 2 / (period + 1);
  let out = values[0];
  for (let i = 1; i < values.length; i++) out = values[i] * k + out * (1 - k);
  return out;
}

export function toSnapshot(symbol: string, candles: BinanceCandle[], timeframe: string): MarketSnapshot | null {
  if (!candles || candles.length < 50) return null;
  const closes = candles.map((c) => c.close);
  const price = closes[closes.length - 1];
  const ind = calculateIndicators(candles);
  const ema200 = ema(closes, Math.min(200, closes.length));
  const volRatio = price > 0 ? (ind.atr / price) * 100 : 0;
  const volatility: MarketSnapshot["volatility"] =
    volRatio > 4 ? "EXTREME" : volRatio > 2 ? "HIGH" : volRatio > 0.8 ? "MEDIUM" : "LOW";
  let trend: MarketSnapshot["trend"] = "NEUTRAL";
  if (ind.ema20 > ind.ema50 && price > ema200) trend = "BULLISH";
  else if (ind.ema20 < ind.ema50 && price < ema200) trend = "BEARISH";

  return {
    symbol: symbol.replace("/", "").toUpperCase(),
    price,
    trend,
    rsi: ind.rsi,
    ema20: ind.ema20,
    ema50: ind.ema50,
    ema200: Number(ema200.toFixed(4)),
    macdSignal: ind.macdSignal,
    atr: ind.atr,
    volatility,
    timeframe,
  };
}

export function riskReward(entry: number, sl: number, tp: number): number {
  const risk = Math.abs(entry - sl);
  const reward = Math.abs(tp - entry);
  if (risk <= 0) return 0;
  return Number((reward / risk).toFixed(2));
}
