import assert from "node:assert/strict";
import { findSwings, detectBosChoch } from "../../market/swings.js";
import { candlesAtOrBefore } from "../backtest/mtf.js";
import type { BinanceCandle } from "../../binance.js";

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

const full: BinanceCandle[] = [];
for (let i = 0; i < 30; i++) {
  const base = 100 + i;
  full.push(
    candle(i, base, {
      high: i === 12 ? 140 : base + 1,
      low: i === 18 ? 90 : base - 1,
    })
  );
}

const left = 2;
const right = 2;
const tIndex = 14;
const atT = full.slice(0, tIndex + 1);

const swingsT = findSwings(atT, left, right);
assert.ok(swingsT.every((s) => s.index <= atT.length - 1 - right), "swing confirmation cannot use unavailable future candles");

const swingsFull = findSwings(full, left, right);
const needsFuture = swingsFull.filter((s) => s.index > atT.length - 1 - right && s.index <= tIndex);
for (const s of needsFuture) {
  assert.equal(
    swingsT.some((x) => x.index === s.index && x.kind === s.kind),
    false,
    "swing at T must not be confirmed with candles after T"
  );
}

const asOf = atT[atT.length - 1].closeTime;
const visible = candlesAtOrBefore(full, asOf);
assert.ok(visible.every((c) => c.openTime <= asOf && c.closeTime <= asOf + 1));
assert.ok(visible.length <= atT.length + 1);

const bosT = detectBosChoch(atT, swingsT);
const bosFull = detectBosChoch(full, swingsFull);
assert.ok(bosT);
assert.ok(bosFull);

console.log("  PASS  No lookahead: swings/BOS at time T see only data <= T");
