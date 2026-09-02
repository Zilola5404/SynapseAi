import type { BinanceCandle } from "../../binance.js";

export function candlesAtOrBefore(candles: BinanceCandle[], timeMs: number) {
  let i = candles.length - 1;
  while (i >= 0 && candles[i].closeTime > timeMs && candles[i].openTime > timeMs) i -= 1;
  return candles.slice(0, i + 1);
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
