import assert from "node:assert/strict";
import { classifyStructure, findSwings, nearestLevels, relativeVolume } from "./swings.js";
import type { BinanceCandle } from "../binance.js";

function candle(i: number, close: number, extra: Partial<BinanceCandle> = {}): BinanceCandle {
  return {
    openTime: i * 60_000,
    open: close,
    high: extra.high ?? close + 1,
    low: extra.low ?? close - 1,
    close,
    volume: extra.volume ?? 10,
    closeTime: i * 60_000 + 59_000,
  };
}

const rising: BinanceCandle[] = [];
for (let i = 0; i < 40; i++) {
  const base = 100 + i;
  const swingHigh = i % 5 === 2;
  const swingLow = i % 5 === 4;
  rising.push(
    candle(i, base, {
      high: swingHigh ? base + 8 + i * 0.4 : base + 1,
      low: swingLow ? base - 2 : base - 1,
      volume: i === 39 ? 30 : 10,
    })
  );
}

const swings = findSwings(rising, 2, 2);
assert.ok(swings.length >= 4);
assert.equal(classifyStructure(swings) === "BULLISH" || classifyStructure(swings) === "RANGE", true);
const levels = nearestLevels(rising[rising.length - 1].close, swings);
assert.ok(levels.lastSwingHigh > 0 || levels.lastSwingLow > 0);
const vol = relativeVolume(rising, 10);
assert.ok(vol.relativeVolume > 1);

console.log("  PASS  Market structure: swings, volume ratio");
