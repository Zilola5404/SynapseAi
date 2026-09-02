import type { BinanceCandle } from "../../binance.js";
import { findSwings } from "../../market/swings.js";
import { INTEL } from "./config.js";
import type { LevelsResult } from "./types.js";

function cluster(prices: number[], pct = 0.4) {
  const sorted = [...prices].filter((p) => p > 0).sort((a, b) => a - b);
  const groups: number[][] = [];
  for (const p of sorted) {
    const g = groups.find((row) => Math.abs(row[0] - p) / p * 100 <= pct);
    if (g) g.push(p);
    else groups.push([p]);
  }
  return groups
    .map((row) => ({ price: row.reduce((s, v) => s + v, 0) / row.length, hits: row.length }))
    .sort((a, b) => b.hits - a.hits);
}

export function analyzeSupportResistance(params: {
  price: number;
  d1?: BinanceCandle[];
  h4?: BinanceCandle[];
  h1?: BinanceCandle[];
  atr: number;
}): LevelsResult {
  const swings = [
    ...(params.d1 ? findSwings(params.d1) : []),
    ...(params.h4 ? findSwings(params.h4) : []),
    ...(params.h1 ? findSwings(params.h1) : []),
  ];
  const highs = swings.filter((s) => s.kind === "H").map((s) => s.price);
  const lows = swings.filter((s) => s.kind === "L").map((s) => s.price);
  const resClusters = cluster(highs.filter((p) => p > params.price));
  const supClusters = cluster(lows.filter((p) => p < params.price));
  const majorResistance = resClusters[0]?.price || 0;
  const majorSupport = supClusters[0]?.price || 0;
  const nearestResistance = highs.filter((p) => p > params.price).sort((a, b) => a - b)[0] || majorResistance;
  const nearestSupport = lows.filter((p) => p < params.price).sort((a, b) => b - a)[0] || majorSupport;
  const r = Math.max(params.atr * 1.5, params.price * 0.004);
  const roomForLong = nearestResistance > 0 ? nearestResistance - params.price >= r * INTEL.minRr : true;
  const roomForShort = nearestSupport > 0 ? params.price - nearestSupport >= r * INTEL.minRr : true;
  const reasons = [
    {
      textRu: nearestResistance
        ? `Ближайшее сопротивление: ${nearestResistance.toFixed(2)}`
        : "Сопротивление не рассчитано",
      textEn: nearestResistance ? `Nearest resistance: ${nearestResistance.toFixed(2)}` : "Resistance not computed",
      ok: roomForLong,
    },
    {
      textRu: nearestSupport ? `Ближайшая поддержка: ${nearestSupport.toFixed(2)}` : "Поддержка не рассчитана",
      textEn: nearestSupport ? `Nearest support: ${nearestSupport.toFixed(2)}` : "Support not computed",
      ok: roomForShort,
    },
  ];
  return {
    majorSupport,
    majorResistance,
    nearestSupport,
    nearestResistance,
    roomForLong,
    roomForShort,
    reasons,
  };
}
