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
  if (params.emaAligned) return "TRENDING";
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

export type BosChoch = { bos: "BULLISH" | "BEARISH" | "NONE"; choch: "BULLISH" | "BEARISH" | "NONE" };

export function detectBosChoch(candles: BinanceCandle[], swings: Swing[]): BosChoch {
  if (!candles.length || swings.length < 2) return { bos: "NONE", choch: "NONE" };
  const last = candles[candles.length - 1];
  const highs = swings.filter((s) => s.kind === "H");
  const lows = swings.filter((s) => s.kind === "L");
  const lastHigh = highs.at(-1)?.price || 0;
  const prevHigh = highs.at(-2)?.price || 0;
  const lastLow = lows.at(-1)?.price || 0;
  const prevLow = lows.at(-2)?.price || 0;
  const structure = classifyStructure(swings);
  let bos: BosChoch["bos"] = "NONE";
  let choch: BosChoch["choch"] = "NONE";
  if (lastHigh && last.close > lastHigh) {
    if (structure === "BULLISH" || (prevHigh > 0 && lastHigh > prevHigh)) bos = "BULLISH";
    else choch = "BULLISH";
  }
  if (lastLow && last.close < lastLow) {
    if (structure === "BEARISH" || (prevLow > 0 && lastLow < prevLow)) bos = "BEARISH";
    else choch = "BEARISH";
  }
  return { bos, choch };
}

export function equalLevels(prices: number[], pct = 0.15) {
  const out: number[] = [];
  const sorted = [...prices].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1];
    const b = sorted[i];
    if (a > 0 && Math.abs(b - a) / a * 100 <= pct) out.push((a + b) / 2);
  }
  return out;
}

export type SweepKind = "HIGH" | "LOW" | "NONE";

export function detectLiquiditySweep(candles: BinanceCandle[], swings: Swing[], atr = 0): SweepKind {
  if (candles.length < 3 || swings.length < 2) return "NONE";
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const highs = swings.filter((s) => s.kind === "H").map((s) => s.price);
  const lows = swings.filter((s) => s.kind === "L").map((s) => s.price);
  const eqh = equalLevels(highs);
  const eql = equalLevels(lows);
  const levelHigh = eqh.at(-1) || highs.at(-1) || 0;
  const levelLow = eql.at(-1) || lows.at(-1) || 0;
  const buf = atr > 0 ? atr * 0.05 : (levelHigh || last.close) * 0.0005;
  const tookHigh = levelHigh > 0 && (last.high > levelHigh + buf || prev.high > levelHigh + buf);
  const backBelow = last.close < levelHigh;
  const tookLow = levelLow > 0 && (last.low < levelLow - buf || prev.low < levelLow - buf);
  const backAbove = last.close > levelLow;
  if (tookHigh && backBelow) return "HIGH";
  if (tookLow && backAbove) return "LOW";
  return "NONE";
}

export function atrPct(price: number, atr: number) {
  return price > 0 ? (atr / price) * 100 : 0;
}

/** Wilder-style ADX. Returns 0 if not enough candles — callers must not invent a trend from this. */
export function computeAdx(candles: BinanceCandle[], period = 14): number {
  if (!candles || candles.length < period + 2) return 0;
  const plus: number[] = [];
  const minus: number[] = [];
  const tr: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const hi = candles[i].high;
    const lo = candles[i].low;
    const prev = candles[i - 1];
    const up = hi - prev.high;
    const down = prev.low - lo;
    plus.push(up > down && up > 0 ? up : 0);
    minus.push(down > up && down > 0 ? down : 0);
    tr.push(Math.max(hi - lo, Math.abs(hi - prev.close), Math.abs(lo - prev.close)));
  }
  const smooth = (arr: number[]) => {
    const seed = arr.slice(0, period).reduce((s, v) => s + v, 0);
    let val = seed;
    const out = [val];
    for (let i = period; i < arr.length; i++) {
      val = val - val / period + arr[i];
      out.push(val);
    }
    return out;
  };
  const smTr = smooth(tr);
  const smP = smooth(plus);
  const smM = smooth(minus);
  const dx: number[] = [];
  const n = Math.min(smTr.length, smP.length, smM.length);
  for (let i = 0; i < n; i++) {
    const diP = smTr[i] > 0 ? (100 * smP[i]) / smTr[i] : 0;
    const diM = smTr[i] > 0 ? (100 * smM[i]) / smTr[i] : 0;
    const den = diP + diM;
    dx.push(den > 0 ? (100 * Math.abs(diP - diM)) / den : 0);
  }
  if (dx.length < period) return 0;
  let adx = dx.slice(0, period).reduce((s, v) => s + v, 0) / period;
  for (let i = period; i < dx.length; i++) adx = (adx * (period - 1) + dx[i]) / period;
  return Number(adx.toFixed(2));
}
