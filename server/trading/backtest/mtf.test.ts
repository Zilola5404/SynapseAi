import assert from "node:assert/strict";
import { candlesAtOrBefore, lastClosedIndex, rollingWalkForwardWindows, threeWaySplit, walkForwardSplit } from "./mtf.js";

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

const split3 = threeWaySplit([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.5, 0.25);
assert.equal(split3.train.length, 5);
assert.equal(split3.validation.length, 2);
assert.equal(split3.outOfSample.length, 3);

assert.equal(lastClosedIndex(candles, 20), 1);
assert.equal(candlesAtOrBefore(candles, 20).length, 2);

const from = Date.parse("2025-01-01T00:00:00Z");
const to = Date.parse("2026-07-01T00:00:00Z");
const wf = rollingWalkForwardWindows(from, to, { trainDays: 182, valDays: 61, oosDays: 61, shiftDays: 61 });
assert.ok(wf.length >= 2, `expected multiple walk-forward windows, got ${wf.length}`);
assert.equal(wf[1].trainStart, wf[0].trainStart + 61 * 86_400_000);
assert.ok(wf[0].oosStart >= wf[0].valEnd);

console.log("  PASS  MTF backtest helpers: time alignment and walk-forward split");
