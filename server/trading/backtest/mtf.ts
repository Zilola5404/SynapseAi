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
