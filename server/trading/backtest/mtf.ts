import type { BinanceCandle } from "../../binance.js";
import { DAY_MS } from "./config.js";

export function candlesAtOrBefore(candles: BinanceCandle[], timeMs: number) {
  const i = lastIndexVisibleAt(candles, timeMs);
  if (i < 0) return [];
  return candles.slice(0, i + 1);
}

/** Same visibility rule as candlesAtOrBefore, O(log n). */
export function lastIndexVisibleAt(candles: BinanceCandle[], timeMs: number) {
  let lo = 0;
  let hi = candles.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const c = candles[mid];
    if (!(c.closeTime > timeMs && c.openTime > timeMs)) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

export function lastClosedIndex(candles: BinanceCandle[], timeMs: number) {
  let lo = 0;
  let hi = candles.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (candles[mid].closeTime <= timeMs) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

/** Closed candles at or before t, capped to live cache size. No future bars. */
export function closedWindow(candles: BinanceCandle[], timeMs: number, maxN: number) {
  const i = lastClosedIndex(candles, timeMs);
  if (i < 0) return [];
  const from = Math.max(0, i - maxN + 1);
  return candles.slice(from, i + 1);
}

export function walkForwardSplit<T>(items: T[], trainPct = 0.7) {
  const cut = Math.max(1, Math.floor(items.length * trainPct));
  return { train: items.slice(0, cut), test: items.slice(cut) };
}

/** Train / validation / out-of-sample. No overlap, time-ordered. */
export function threeWaySplit<T>(items: T[], trainPct = 0.5, valPct = 0.25) {
  const n = items.length;
  const trainEnd = Math.max(1, Math.floor(n * trainPct));
  const valEnd = Math.min(n, Math.max(trainEnd + 1, Math.floor(n * (trainPct + valPct))));
  return {
    train: items.slice(0, trainEnd),
    validation: items.slice(trainEnd, valEnd),
    outOfSample: items.slice(valEnd),
  };
}

export type WalkWindow = {
  id: number;
  trainStart: number;
  trainEnd: number;
  valStart: number;
  valEnd: number;
  oosStart: number;
  oosEnd: number;
};

export function rollingWalkForwardWindows(
  fromMs: number,
  toMs: number,
  spec: { trainDays: number; valDays: number; oosDays: number; shiftDays: number }
): WalkWindow[] {
  const train = spec.trainDays * DAY_MS;
  const val = spec.valDays * DAY_MS;
  const oos = spec.oosDays * DAY_MS;
  const shift = spec.shiftDays * DAY_MS;
  const span = train + val + oos;
  const out: WalkWindow[] = [];
  let t = fromMs;
  let id = 1;
  while (t + span <= toMs + DAY_MS / 2) {
    out.push({
      id,
      trainStart: t,
      trainEnd: t + train,
      valStart: t + train,
      valEnd: t + train + val,
      oosStart: t + train + val,
      oosEnd: t + train + val + oos,
    });
    t += shift;
    id += 1;
  }
  return out;
}

export function indexRangeForTime(candles: BinanceCandle[], startMs: number, endMs: number) {
  let start = -1;
  let end = -1;
  for (let i = 0; i < candles.length; i++) {
    const t = candles[i].closeTime || candles[i].openTime;
    if (start < 0 && t >= startMs) start = i;
    if (t < endMs) end = i;
  }
  return { start, end };
}
