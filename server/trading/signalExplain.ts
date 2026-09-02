import type { MarketSnapshot, TradeSide } from "./types.js";

export const SIGNAL_TTL_MS = 120_000;
export const SIGNAL_PRICE_DRIFT_PCT = 0.8;

export type SignalFactor = { ok: boolean; textRu: string; textEn: string };
export type SignalStrength = "weak" | "medium" | "strong" | "very_strong";

export function signalStrength(confidence: number): SignalStrength {
  if (confidence >= 85) return "very_strong";
  if (confidence >= 70) return "strong";
  if (confidence >= 50) return "medium";
  return "weak";
}

export function signalStrengthLabel(confidence: number, lang: "ru" | "en") {
  const s = signalStrength(confidence);
  if (lang === "en") {
    if (s === "very_strong") return "🔥 Very strong";
    if (s === "strong") return "🟢 Strong";
    if (s === "medium") return "🟡 Medium";
    return "🔴 Weak";
  }
  if (s === "very_strong") return "🔥 Очень сильный";
  if (s === "strong") return "🟢 Высокая";
  if (s === "medium") return "🟡 Средняя";
  return "🔴 Слабый";
}

export function buildSignalFactors(h1: MarketSnapshot, m5: MarketSnapshot, direction: TradeSide): SignalFactor[] {
  const long = direction === "LONG";
  const trendOk = long ? h1.trend === "BULLISH" || h1.price > h1.ema200 : h1.trend === "BEARISH" || h1.price < h1.ema200;
  const emaOk = long ? h1.ema20 > h1.ema50 : h1.ema20 < h1.ema50;
  const rsiOk = long ? m5.rsi > 45 && m5.rsi < 70 : m5.rsi < 55 && m5.rsi > 30;
  const macdOk = long
    ? m5.macdSignal === "BULLISH_CROSS" || h1.trend === "BULLISH"
    : m5.macdSignal === "BEARISH_CROSS" || h1.trend === "BEARISH";
  const volOk = m5.volatility !== "EXTREME" && m5.volatility !== "LOW";
  return [
    {
      ok: trendOk,
      textRu: long ? "Цена выше основной трендовой линии" : "Цена ниже основной трендовой линии",
      textEn: long ? "Price is above the main trend line" : "Price is below the main trend line",
    },
    {
      ok: emaOk,
      textRu: long ? "Краткосрочный тренд направлен вверх" : "Краткосрочный тренд направлен вниз",
      textEn: long ? "Short-term trend is up" : "Short-term trend is down",
    },
    {
      ok: rsiOk,
      textRu: `RSI ${m5.rsi.toFixed(0)} — ${rsiOk ? "нейтрально-позитивный" : "не в рабочей зоне"}`,
      textEn: `RSI ${m5.rsi.toFixed(0)} — ${rsiOk ? "neutral-positive" : "outside the working zone"}`,
    },
    {
      ok: macdOk,
      textRu: macdOk ? "Технические индикаторы поддерживают сценарий" : "MACD не подтверждает сценарий",
      textEn: macdOk ? "Technical indicators support the scenario" : "MACD does not confirm the scenario",
    },
    {
      ok: volOk,
      textRu: volOk ? "Волатильность рабочая, не экстремальная" : "Волатильность не подходит",
      textEn: volOk ? "Volatility is usable, not extreme" : "Volatility is not suitable",
    },
  ];
}

export function potentialMoveUsdt(entry: number, target: number, sizeUsdt: number) {
  if (!entry) return 0;
  return sizeUsdt * Math.abs(target - entry) / entry;
}

export function isSignalExpired(expiresAt: Date | null | undefined, now = Date.now()) {
  if (!expiresAt) return false;
  return expiresAt.getTime() <= now;
}

export function priceMovedTooFar(signalEntry: number, livePrice: number, maxPct = SIGNAL_PRICE_DRIFT_PCT) {
  if (!signalEntry || !livePrice) return true;
  return (Math.abs(livePrice - signalEntry) / signalEntry) * 100 > maxPct;
}
