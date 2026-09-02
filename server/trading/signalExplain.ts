import type { MarketSnapshot, TradeSide } from "./types.js";

export const SIGNAL_TTL_MS = 120_000;
export const SIGNAL_PRICE_DRIFT_PCT = 0.8;

export type SignalFactor = { ok: boolean; textRu: string; textEn: string };
export type SignalStrength = "weak" | "medium" | "strong" | "very_strong";

export function signalStrength(score: number): SignalStrength {
  if (score <= 15) {
    if (score >= 13) return "very_strong";
    if (score >= 10) return "strong";
    if (score >= 7) return "medium";
    return "weak";
  }
  if (score >= 85) return "very_strong";
  if (score >= 70) return "strong";
  if (score >= 50) return "medium";
  return "weak";
}

export function setupGradeLabel(grade: string | undefined, lang: "ru" | "en") {
  if (grade === "A+") return lang === "en" ? "🟢 A+ SETUP" : "🟢 A+ СЕТАП";
  if (grade === "A") return lang === "en" ? "🟢 A SETUP" : "🟢 A СЕТАП";
  if (grade === "B") return lang === "en" ? "🟡 B SETUP" : "🟡 B СЕТАП";
  return lang === "en" ? "🔴 NO TRADE" : "🔴 СДЕЛКА НЕ РЕКОМЕНДУЕТСЯ";
}

export type ConfluencePayload = {
  version: 2;
  confluence: number;
  max: number;
  grade: string;
  setupType?: string;
  tp1?: number;
  tp2?: number;
  tp3?: number | null;
  invalidation?: string;
  lines: Array<{ ok?: boolean; textRu?: string; textEn?: string; points?: number; max?: number }>;
};

export function encodeConfluencePayload(signal: {
  confluenceScore?: number;
  qualityScore?: number;
  confidence: number;
  setupGrade?: string;
  setupType?: string;
  takeProfit1?: number;
  takeProfit2?: number;
  takeProfit3?: number | null;
  invalidation?: string;
  scoreLines?: Array<{ ok: boolean; textRu: string; textEn: string; points: number; max: number }>;
}): string {
  const payload: ConfluencePayload = {
    version: 2,
    confluence: signal.confluenceScore ?? signal.qualityScore ?? signal.confidence,
    max: 15,
    grade: signal.setupGrade || "",
    setupType: signal.setupType,
    tp1: signal.takeProfit1,
    tp2: signal.takeProfit2,
    tp3: signal.takeProfit3,
    invalidation: signal.invalidation,
    lines: signal.scoreLines || [],
  };
  return JSON.stringify(payload);
}

export function parseSignalFactors(raw: string | null | undefined): {
  factors: SignalFactor[];
  payload: ConfluencePayload | null;
} {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && parsed.version === 2) {
      const lines = Array.isArray(parsed.lines) ? parsed.lines : [];
      return {
        payload: parsed as ConfluencePayload,
        factors: lines.map((item: { ok?: boolean; textRu?: string; textEn?: string; points?: number; max?: number }) => {
          const extra = item.points != null && item.max != null ? ` (${item.points}/${item.max})` : "";
          return {
            ok: Boolean(item.ok),
            textRu: `${item.textRu || ""}${extra}`,
            textEn: `${item.textEn || ""}${extra}`,
          };
        }),
      };
    }
    if (Array.isArray(parsed)) {
      return {
        payload: null,
        factors: parsed.map((item: { ok?: boolean; textRu?: string; textEn?: string; points?: number; max?: number }) => {
          const extra = item.points != null && item.max != null ? ` (${item.points}/${item.max})` : "";
          return {
            ok: Boolean(item.ok),
            textRu: `${item.textRu || ""}${extra}`,
            textEn: `${item.textEn || ""}${extra}`,
          };
        }),
      };
    }
  } catch {
    return { factors: [], payload: null };
  }
  return { factors: [], payload: null };
}

export function signalStrengthLabel(score: number, lang: "ru" | "en") {
  const s = signalStrength(score);
  if (lang === "en") {
    if (s === "very_strong") return "🔥 Very strong setup";
    if (s === "strong") return "🟢 Strong setup";
    if (s === "medium") return "🟡 Average setup";
    return "🔴 Weak setup";
  }
  if (s === "very_strong") return "🔥 Очень сильный сетап";
  if (s === "strong") return "🟢 Сильный сетап";
  if (s === "medium") return "🟡 Средний сетап";
  return "🔴 Слабый сетап";
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
  const volumeKnown = typeof m5.relativeVolume === "number" && m5.relativeVolume > 0;
  const volumeOk = volumeKnown && m5.relativeVolume! >= 1.2;
  const factors: SignalFactor[] = [
    {
      ok: trendOk,
      textRu: long ? "Тренд: восходящий" : "Тренд: нисходящий",
      textEn: long ? "Trend: up" : "Trend: down",
    },
    {
      ok: emaOk,
      textRu: long ? "Краткосрочный тренд направлен вверх" : "Краткосрочный тренд направлен вниз",
      textEn: long ? "Short-term trend is up" : "Short-term trend is down",
    },
    {
      ok: rsiOk,
      textRu: `RSI ${m5.rsi.toFixed(0)} — ${rsiOk ? "рабочая зона" : "не в рабочей зоне"}`,
      textEn: `RSI ${m5.rsi.toFixed(0)} — ${rsiOk ? "in range" : "outside the working zone"}`,
    },
    {
      ok: macdOk,
      textRu: macdOk ? "Momentum подтверждает сценарий" : "MACD не подтверждает сценарий",
      textEn: macdOk ? "Momentum supports the scenario" : "MACD does not confirm the scenario",
    },
    {
      ok: volumeKnown ? volumeOk : false,
      textRu: volumeKnown
        ? `Объём x${m5.relativeVolume!.toFixed(2)} ${volumeOk ? "подтверждает" : "слабый"}`
        : "Объём в этом снимке не анализировался",
      textEn: volumeKnown
        ? `Volume x${m5.relativeVolume!.toFixed(2)} ${volumeOk ? "confirms" : "is weak"}`
        : "Volume was not analyzed in this snapshot",
    },
    {
      ok: volOk,
      textRu: volOk ? "Волатильность допустимая" : "Волатильность не подходит",
      textEn: volOk ? "Volatility is acceptable" : "Volatility is not suitable",
    },
  ];
  return factors;
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
