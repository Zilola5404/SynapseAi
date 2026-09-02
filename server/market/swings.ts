import type { BinanceCandle } from "../binance.js";

export type Swing = { kind: "H" | "L"; index: number; price: number };
export type MarketStructure = "BULLISH" | "BEARISH" | "RANGE";
export type MarketRegime = "TRENDING" | "RANGING" | "HIGH_VOLATILITY" | "LOW_VOLATILITY";

export function findSwings(candles: BinanceCandle[], left = 2, right = 2): Swing[] {
  const out: Swing[] = [];
  if (!candles || candles.length < left + right + 1) return out;
  for (let i = left; i < candles.length - right; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    let isHigh = true;
    let isLow = true;
    for (let j = i - left; j <= i + right; j++) {
      if (j === i) continue;
      if (candles[j].high >= h) isHigh = false;
      if (candles[j].low <= l) isLow = false;
    }
    if (isHigh) out.push({ kind: "H", index: i, price: h });
    else if (isLow) out.push({ kind: "L", index: i, price: l });
  }
  return out;
}

export function classifyStructure(swings: Swing[]): MarketStructure {
  const highs = swings.filter((s) => s.kind === "H").slice(-3);
  const lows = swings.filter((s) => s.kind === "L").slice(-3);
  if (highs.length < 2 || lows.length < 2) return "RANGE";
  const hh = highs[highs.length - 1].price > highs[highs.length - 2].price;
  const hl = lows[lows.length - 1].price > lows[lows.length - 2].price;
  const ll = lows[lows.length - 1].price < lows[lows.length - 2].price;
  const lh = highs[highs.length - 1].price < highs[highs.length - 2].price;
  if (hh && hl) return "BULLISH";
  if (ll && lh) return "BEARISH";
  return "RANGE";
}

export function nearestLevels(price: number, swings: Swing[]) {
  const highs = swings.filter((s) => s.kind === "H").map((s) => s.price).filter((p) => p > price);
  const lows = swings.filter((s) => s.kind === "L").map((s) => s.price).filter((p) => p < price);
  const nearestResistance = highs.length ? Math.min(...highs) : 0;
  const nearestSupport = lows.length ? Math.max(...lows) : 0;
  const lastSwingHigh = swings.filter((s) => s.kind === "H").at(-1)?.price || 0;
  const lastSwingLow = swings.filter((s) => s.kind === "L").at(-1)?.price || 0;
  return { nearestResistance, nearestSupport, lastSwingHigh, lastSwingLow };
}

export function detectRegime(params: {
  structure: MarketStructure;
  volatility: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  emaAligned: boolean;
}): MarketRegime {
  if (params.volatility === "EXTREME") return "HIGH_VOLATILITY";
  if (params.volatility === "LOW") return "LOW_VOLATILITY";
  if ((params.structure === "BULLISH" || params.structure === "BEARISH") && params.emaAligned) return "TRENDING";
  if (params.emaAligned && params.volatility !== "LOW") return "TRENDING";
  return "RANGING";
}

export function relativeVolume(candles: BinanceCandle[], period = 20) {
  if (!candles.length) return { volume: 0, avgVolume: 0, relativeVolume: 0 };
  const vols = candles.map((c) => c.volume || 0);
  const last = vols[vols.length - 1] || 0;
  const window = vols.slice(-Math.max(period, 1));
  const avg = window.reduce((s, v) => s + v, 0) / window.length;
  return {
    volume: last,
    avgVolume: avg,
    relativeVolume: avg > 0 ? last / avg : 0,
  };
}
