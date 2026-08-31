import assert from "node:assert/strict";
import { CandleCache } from "./candleCache.js";
import { computeImbalance } from "./depth.js";
import { nextBackoffMs } from "../websocket.js";
import type { BinanceCandle } from "../binance.js";

function candle(openTime: number, close: number): BinanceCandle {
  return { openTime, open: close, high: close + 1, low: close - 1, close, volume: 1, closeTime: openTime + 59_000 };
}

const cache = new CandleCache();
for (let i = 0; i < 505; i++) cache.upsert("btcusdt", candle(i * 60_000, 100 + i));
assert.equal(cache.size("BTCUSDT"), 500, "кеш держит максимум 500 свечей");
assert.equal(cache.get("BTC/USDT")[0].openTime, 5 * 60_000, "старые свечи вытесняются, история не теряется целиком");

cache.upsert("BTCUSDT", candle(504 * 60_000, 999));
assert.equal(cache.get("BTCUSDT").at(-1)?.close, 999, "обновление той же свечи");
assert.ok(cache.indicators("BTCUSDT"), "индикаторы считаются из кеша");

const imb = computeImbalance([[100, 2]], [[100, 1]]);
assert.equal(imb, 33);

assert.equal(nextBackoffMs(0), 1000);
assert.equal(nextBackoffMs(1), 2000);
assert.equal(nextBackoffMs(2), 4000);
assert.equal(nextBackoffMs(10), 60_000);

console.log("  PASS  Этап 2: candle cache 500, exponential backoff, depth imbalance");
