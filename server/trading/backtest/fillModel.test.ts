import assert from "node:assert/strict";
import { simulateFill } from "./fillModel.js";
import type { BinanceCandle } from "../../binance.js";
import type { StrategySignal } from "../types.js";

function bar(i: number, open: number, high: number, low: number, close: number): BinanceCandle {
  const openTime = i * 300_000;
  return { openTime, open, high, low, close, volume: 1, closeTime: openTime + 299_000 };
}

function longSignal(): StrategySignal {
  return {
    symbol: "BTCUSDT",
    direction: "LONG",
    confidence: 12,
    qualityScore: 12,
    entryPrice: 100,
    stopLoss: 98,
    takeProfit: 104,
    takeProfit1: 102,
    takeProfit2: 104,
    takeProfit3: 106,
    riskReward: 2,
    reasoning: "test",
    strategy: "TEST",
  };
}

const signalBar = bar(0, 100, 100.5, 99.5, 100);
const pathA = [
  signalBar,
  bar(1, 100, 105, 97, 101),
];
const sameBar = simulateFill(pathA, 0, longSignal(), [], 10);
assert.ok(sameBar);
assert.equal(sameBar.exitReason, "SL");
assert.equal(sameBar.ambiguousSlTpBar, true);
assert.ok(sameBar.exit <= 98.01);

const pathTp = [
  signalBar,
  bar(1, 100, 102.2, 99.6, 102),
  bar(2, 102, 104.2, 101.5, 104),
  bar(3, 104, 106.2, 103.5, 106),
];
const tp = simulateFill(pathTp, 0, longSignal(), [], 10);
assert.ok(tp);
assert.equal(tp.exitReason, "TP3");
assert.equal(tp.tpHits, 3);
assert.equal(tp.ambiguousSlTpBar, false);

const pathTime = [
  signalBar,
  bar(1, 100, 100.4, 99.7, 100.2),
  bar(2, 100.2, 100.5, 99.8, 100.1),
];
const timed = simulateFill(pathTime, 0, longSignal(), [], 1);
assert.ok(timed);
assert.equal(timed.exitReason, "TIME");
assert.ok(timed.mfeR >= 0);
assert.ok(timed.maeR <= 0);

const eod = simulateFill(pathTime, 0, longSignal(), [], 1_000_000);
assert.ok(eod);
assert.equal(eod.exitReason, "EOD");

const pathMfe = [
  signalBar,
  bar(1, 100, 103, 99.2, 101),
  bar(2, 101, 101.2, 97.5, 98),
];
const mfe = simulateFill(pathMfe, 0, longSignal(), [], 10);
assert.ok(mfe);
assert.equal(mfe.exitReason, "SL");
assert.ok(mfe.mfeR > 1, `MFE ${mfe.mfeR}`);
assert.ok(mfe.maeR < -0.5, `MAE ${mfe.maeR}`);

console.log("  PASS  Fill model: worst-case same-bar SL, partial TP, TIME, MAE/MFE");
