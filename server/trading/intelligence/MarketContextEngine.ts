import type { MarketSnapshot } from "../types.js";
import { INTEL } from "./config.js";
import type { BtcTrend, MarketContext, VolBucket } from "./types.js";

function trendOf(snap: MarketSnapshot | null | undefined): BtcTrend {
  if (!snap) return "NEUTRAL";
  return snap.trend;
}

function volOf(snaps: Array<MarketSnapshot | null | undefined>): VolBucket {
  const ranks: VolBucket[] = ["LOW", "NORMAL", "HIGH", "EXTREME"];
  let worst: VolBucket = "LOW";
  for (const s of snaps) {
    if (!s) continue;
    const v: VolBucket =
      s.volatility === "EXTREME" ? "EXTREME" : s.volatility === "HIGH" ? "HIGH" : s.volatility === "LOW" ? "LOW" : "NORMAL";
    if (ranks.indexOf(v) > ranks.indexOf(worst)) worst = v;
  }
  return worst;
}

export function analyzeMarketContext(btc: {
  d1?: MarketSnapshot | null;
  h4?: MarketSnapshot | null;
  h1?: MarketSnapshot | null;
}): MarketContext {
  const btcTrend1D = trendOf(btc.d1);
  const btcTrend4H = trendOf(btc.h4);
  const btcTrend1H = trendOf(btc.h1);
  const volatility = volOf([btc.d1, btc.h4, btc.h1]);

  let marketMode: MarketContext["marketMode"] = "NEUTRAL";
  if (btcTrend1D === "BULLISH" && btcTrend4H === "BULLISH" && volatility !== "EXTREME" && volatility !== "HIGH") {
    marketMode = "RISK_ON";
  } else if (
    (btcTrend1D === "BEARISH" && btcTrend4H === "BEARISH") ||
    volatility === "EXTREME"
  ) {
    marketMode = "RISK_OFF";
  }

  const blockAltLong =
    btcTrend1D === "BEARISH" &&
    btcTrend4H === "BEARISH" &&
    (volatility === "HIGH" || volatility === "EXTREME");

  const reasons = [
    {
      textRu: `BTC 1D: ${btcTrend1D === "BULLISH" ? "бычий" : btcTrend1D === "BEARISH" ? "медвежий" : "нейтральный"}`,
      textEn: `BTC 1D: ${btcTrend1D.toLowerCase()}`,
      ok: btcTrend1D !== "NEUTRAL",
    },
    {
      textRu: `BTC 4H: ${btcTrend4H === "BULLISH" ? "бычий" : btcTrend4H === "BEARISH" ? "медвежий" : "нейтральный"}`,
      textEn: `BTC 4H: ${btcTrend4H.toLowerCase()}`,
      ok: btcTrend4H !== "NEUTRAL",
    },
    {
      textRu: `Режим рынка: ${marketMode === "RISK_ON" ? "риск включён" : marketMode === "RISK_OFF" ? "риск выключен" : "нейтральный"}`,
      textEn: `Market mode: ${marketMode}`,
      ok: marketMode === "RISK_ON",
    },
  ];
  if (blockAltLong) {
    reasons.push({
      textRu: "BTC падает при высокой волатильности — LONG по альтам запрещён",
      textEn: "BTC is bearish with high volatility — altcoin LONGs are blocked",
      ok: false,
    });
  }

  void INTEL;
  return { btcTrend1D, btcTrend4H, btcTrend1H, volatility, marketMode, score: 0, reasons, blockAltLong };
}

export function contextPointsFor(direction: "LONG" | "SHORT", ctx: MarketContext): { points: number; reason: { textRu: string; textEn: string; ok: boolean } } {
  if (direction === "LONG") {
    if (ctx.blockAltLong || ctx.marketMode === "RISK_OFF") {
      return {
        points: 0,
        reason: {
          textRu: "BTC не поддерживает покупки",
          textEn: "BTC does not support longs",
          ok: false,
        },
      };
    }
    if (ctx.marketMode === "RISK_ON" || (ctx.btcTrend1D === "BULLISH" && ctx.btcTrend4H !== "BEARISH")) {
      return { points: 2, reason: { textRu: "BTC поддерживает сценарий", textEn: "BTC supports the scenario", ok: true } };
    }
    return { points: 1, reason: { textRu: "BTC нейтрален", textEn: "BTC is neutral", ok: false } };
  }
  if (ctx.btcTrend1D === "BEARISH" && ctx.btcTrend4H === "BEARISH") {
    return { points: 2, reason: { textRu: "BTC поддерживает продажи", textEn: "BTC supports shorts", ok: true } };
  }
  if (ctx.marketMode === "RISK_ON") {
    return { points: 0, reason: { textRu: "BTC бычий — SHORT слабее", textEn: "BTC is bullish — shorts are weaker", ok: false } };
  }
  return { points: 1, reason: { textRu: "BTC нейтрален для SHORT", textEn: "BTC is neutral for shorts", ok: false } };
}
