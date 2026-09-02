import assert from "node:assert/strict";
import { candlesAtOrBefore, walkForwardSplit } from "./mtf.js";

const candles = [
  { openTime: 1, open: 1, high: 1, low: 1, close: 1, volume: 1, closeTime: 10 },
  { openTime: 11, open: 1, high: 1, low: 1, close: 1, volume: 1, closeTime: 20 },
  { openTime: 21, open: 1, high: 1, low: 1, close: 1, volume: 1, closeTime: 30 },
];
assert.equal(candlesAtOrBefore(candles, 20).length, 2);
assert.equal(candlesAtOrBefore(candles, 30).length, 3);
const split = walkForwardSplit([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.7);
assert.equal(split.train.length, 7);
assert.equal(split.test.length, 3);

console.log("  PASS  MTF backtest helpers: time alignment and walk-forward split");
