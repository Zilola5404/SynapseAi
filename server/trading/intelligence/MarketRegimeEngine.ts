import type { BinanceCandle } from "../../binance.js";
import { computeAdx, atrPct } from "../../market/swings.js";
import { INTEL } from "./config.js";
import type { MarketSnapshot } from "../types.js";
import type { RegimeResult, RegimeState } from "./types.js";

export function analyzeRegime(params: {
  h1: MarketSnapshot;
  h4?: MarketSnapshot | null;
  m5?: MarketSnapshot | null;
  candles?: BinanceCandle[];
}): RegimeResult {
  const snap = params.h4 || params.h1;
  const entry = params.m5 || snap;
  const atrPctVal = atrPct(entry.price || snap.price, entry.atr || snap.atr);
  const adx = params.candles?.length ? computeAdx(params.candles) : 0;
  const emaAligned =
    (snap.ema20 > snap.ema50 && snap.price > snap.ema200) ||
    (snap.ema20 < snap.ema50 && snap.price < snap.ema200);

  let regime: RegimeState = "RANGING";
  if (entry.volatility === "EXTREME" || snap.volatility === "EXTREME" || atrPctVal >= INTEL.atrExtremePct) {
    regime = "EXTREME_VOLATILITY";
  } else if (entry.volatility === "HIGH" || snap.volatility === "HIGH" || atrPctVal >= INTEL.atrHighPct) {
    regime = "HIGH_VOLATILITY";
  } else if ((adx >= INTEL.adxTrend || emaAligned) && (snap.structure === "BULLISH" || snap.structure === "BEARISH" || snap.trend !== "NEUTRAL")) {
    regime = "TRENDING";
  } else if (adx > 0 && adx < INTEL.adxRange) {
    regime = "RANGING";
  } else if (!emaAligned) {
    regime = "RANGING";
  }

  const noNewTrades = regime === "EXTREME_VOLATILITY" || regime === "RANGING";
  const reasons = [
    {
      textRu:
        regime === "EXTREME_VOLATILITY"
          ? "Экстремальная волатильность — новые сделки запрещены"
          : regime === "RANGING"
            ? "Рынок в боковике — трендовая стратегия не применяется"
            : regime === "HIGH_VOLATILITY"
              ? "Волатильность повышенная"
              : "Режим: тренд",
      textEn: `Regime: ${regime}`,
      ok: regime === "TRENDING",
    },
  ];
  if (adx > 0) {
    reasons.push({
      textRu: `ADX ${adx.toFixed(1)}`,
      textEn: `ADX ${adx.toFixed(1)}`,
      ok: adx >= INTEL.adxTrend,
    });
  }
  return { regime, adx, atrPct: Number(atrPctVal.toFixed(3)), noNewTrades, reasons };
}
