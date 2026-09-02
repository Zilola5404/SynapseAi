import { riskReward } from "../../market/TechnicalAnalysis.js";
import { INTEL } from "./config.js";
import type { MarketSnapshot, TradeSide } from "../types.js";
import type { LevelsResult, SetupCandidate, StructureResult, TradePlan } from "./types.js";

export function buildTradePlan(params: {
  symbol: string;
  direction: TradeSide;
  setup: SetupCandidate;
  score: number;
  grade: TradePlan["grade"];
  h1: MarketSnapshot;
  m5: MarketSnapshot;
  structure: StructureResult;
  levels: LevelsResult;
}): TradePlan | null {
  const entry = params.m5.price;
  const atr = params.m5.atr || params.h1.atr || entry * 0.01;
  const buffer = Math.max(atr * 0.15, entry * 0.001);

  let stopLoss: number;
  if (params.direction === "LONG") {
    const swing = params.structure.lastSwingLow || params.levels.nearestSupport || params.h1.lastSwingLow || 0;
    stopLoss = swing > 0 && swing < entry ? swing - buffer : entry - atr * 1.5;
    if (stopLoss >= entry) stopLoss = entry - atr * 1.5;
  } else {
    const swing = params.structure.lastSwingHigh || params.levels.nearestResistance || params.h1.lastSwingHigh || 0;
    stopLoss = swing > 0 && swing > entry ? swing + buffer : entry + atr * 1.5;
    if (stopLoss <= entry) stopLoss = entry + atr * 1.5;
  }

  const r = Math.abs(entry - stopLoss);
  if (r <= 0) return null;
  const takeProfit1 = params.direction === "LONG" ? entry + r : entry - r;
  const takeProfit2 = params.direction === "LONG" ? entry + r * INTEL.minRr : entry - r * INTEL.minRr;
  let takeProfit3: number | null = null;
  if (params.direction === "LONG" && params.levels.nearestResistance > takeProfit2) {
    takeProfit3 = params.levels.nearestResistance - buffer;
    if (takeProfit3 <= takeProfit2) takeProfit3 = null;
  }
  if (params.direction === "SHORT" && params.levels.nearestSupport > 0 && params.levels.nearestSupport < takeProfit2) {
    takeProfit3 = params.levels.nearestSupport + buffer;
    if (takeProfit3 >= takeProfit2) takeProfit3 = null;
  }

  const rr = riskReward(entry, stopLoss, takeProfit2);
  const invalidation =
    params.direction === "LONG"
      ? `Закрытие ниже swing low ${stopLoss.toFixed(2)}`
      : `Закрытие выше swing high ${stopLoss.toFixed(2)}`;

  return {
    symbol: params.symbol,
    direction: params.direction,
    setupType: params.setup.type,
    setupScore: params.score,
    grade: params.grade,
    entry: Number(entry.toFixed(4)),
    stopLoss: Number(stopLoss.toFixed(4)),
    takeProfit1: Number(takeProfit1.toFixed(4)),
    takeProfit2: Number(takeProfit2.toFixed(4)),
    takeProfit3: takeProfit3 != null ? Number(takeProfit3.toFixed(4)) : null,
    riskReward: rr,
    invalidation,
    reasons: [
      ...params.setup.reasons,
      {
        textRu: `SL по структуре: ${stopLoss.toFixed(2)} (swing + ATR buffer)`,
        textEn: `Structure stop: ${stopLoss.toFixed(2)} (swing + ATR buffer)`,
        ok: true,
      },
    ],
  };
}
