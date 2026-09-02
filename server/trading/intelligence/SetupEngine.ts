import { trendMomentumLongOk, trendMomentumShortOk } from "../signal/SignalEngine.js";
import type { MarketSnapshot, TradeSide } from "../types.js";
import type { LevelsResult, MultiTimeframeAnalysis, RegimeResult, SetupCandidate, StructureResult } from "./types.js";

function pullbackLong(h1: MarketSnapshot, levels: LevelsResult): boolean {
  const nearEma = h1.price <= h1.ema20 * 1.004 && h1.price >= h1.ema50 * 0.992;
  const nearSupport = levels.nearestSupport > 0 && (h1.price - levels.nearestSupport) / h1.price <= 0.012;
  return nearEma || nearSupport;
}

function pullbackShort(h1: MarketSnapshot, levels: LevelsResult): boolean {
  const nearEma = h1.price >= h1.ema20 * 0.996 && h1.price <= h1.ema50 * 1.008;
  const nearRes = levels.nearestResistance > 0 && (levels.nearestResistance - h1.price) / h1.price <= 0.012;
  return nearEma || nearRes;
}

function retestLong(h1: MarketSnapshot, levels: LevelsResult, m5: MarketSnapshot): boolean {
  if (!levels.nearestSupport && !h1.lastSwingHigh) return false;
  const level = levels.nearestSupport || h1.lastSwingHigh || 0;
  const near = level > 0 && Math.abs(h1.price - level) / h1.price <= 0.008;
  return near && (m5.macdSignal === "BULLISH_CROSS" || m5.trend === "BULLISH");
}

function retestShort(h1: MarketSnapshot, levels: LevelsResult, m5: MarketSnapshot): boolean {
  if (!levels.nearestResistance && !h1.lastSwingLow) return false;
  const level = levels.nearestResistance || h1.lastSwingLow || 0;
  const near = level > 0 && Math.abs(h1.price - level) / h1.price <= 0.008;
  return near && (m5.macdSignal === "BEARISH_CROSS" || m5.trend === "BEARISH");
}

export function detectSetup(params: {
  mtf: MultiTimeframeAnalysis;
  structure: StructureResult;
  levels: LevelsResult;
  regime: RegimeResult;
}): SetupCandidate | null {
  const h1 = params.mtf.h1;
  const m15 = params.mtf.m15;
  const m5 = params.mtf.m5;
  if (!h1 || !m15 || !m5) return null;
  if (params.regime.noNewTrades) return null;

  const h4Bull = (params.mtf.h4?.trend || params.mtf.mainTrend) === "BULLISH";
  const h4Bear = (params.mtf.h4?.trend || params.mtf.mainTrend) === "BEARISH";
  const structBull = params.structure.structure === "BULLISH";
  const structBear = params.structure.structure === "BEARISH";
  const confirmLong = params.mtf.confirmOk && h4Bull;
  const confirmShort = params.mtf.confirmOk && h4Bear;

  if (h4Bull && structBull && pullbackLong(h1, params.levels) && confirmLong && trendMomentumLongOk(h1, m5)) {
    return {
      type: "TREND_PULLBACK",
      direction: "LONG",
      reasons: [
        { textRu: "4H восходящий тренд", textEn: "4H uptrend", ok: true },
        { textRu: "1H структура восходящая", textEn: "1H structure is bullish", ok: true },
        { textRu: "Откат к поддержке / EMA", textEn: "Pullback to support / EMA", ok: true },
        { textRu: "15m подтверждает, 5m — точка входа", textEn: "15m confirms, 5m is entry timing", ok: true },
      ],
    };
  }
  if (h4Bear && structBear && pullbackShort(h1, params.levels) && confirmShort && trendMomentumShortOk(h1, m5)) {
    return {
      type: "TREND_PULLBACK",
      direction: "SHORT",
      reasons: [
        { textRu: "4H нисходящий тренд", textEn: "4H downtrend", ok: true },
        { textRu: "1H структура нисходящая", textEn: "1H structure is bearish", ok: true },
        { textRu: "Откат к сопротивлению / EMA", textEn: "Pullback to resistance / EMA", ok: true },
        { textRu: "15m подтверждает, 5m — точка входа", textEn: "15m confirms, 5m is entry timing", ok: true },
      ],
    };
  }
  if (h4Bull && retestLong(h1, params.levels, m5) && trendMomentumLongOk(h1, m5)) {
    return {
      type: "BREAKOUT_RETEST",
      direction: "LONG",
      reasons: [
        { textRu: "Пробой и ретест уровня", textEn: "Breakout and retest of a level", ok: true },
        { textRu: "5m подтверждает вход", textEn: "5m confirms entry", ok: true },
      ],
    };
  }
  if (h4Bear && retestShort(h1, params.levels, m5) && trendMomentumShortOk(h1, m5)) {
    return {
      type: "BREAKOUT_RETEST",
      direction: "SHORT",
      reasons: [
        { textRu: "Пробой и ретест уровня вниз", textEn: "Breakdown and retest of a level", ok: true },
        { textRu: "5m подтверждает вход", textEn: "5m confirms entry", ok: true },
      ],
    };
  }
  void params.structure;
  return null;
}

export function setupDirection(candidate: SetupCandidate | null): TradeSide | null {
  return candidate?.direction || null;
}
