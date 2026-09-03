import assert from "node:assert/strict";
import { binanceRetryDelayMs, isRetryableBinanceHttp, isRetryableBinanceNetwork } from "./retry.js";

assert.equal(isRetryableBinanceHttp(500), true);
assert.equal(isRetryableBinanceHttp(502), true);
assert.equal(isRetryableBinanceHttp(429), true);
assert.equal(isRetryableBinanceHttp(400), false);
assert.equal(isRetryableBinanceHttp(401), false);
assert.equal(isRetryableBinanceHttp(404), false);

assert.equal(isRetryableBinanceNetwork(new Error("Connect Timeout Error")), true);
const abort = new Error("The operation was aborted.");
abort.name = "AbortError";
assert.equal(isRetryableBinanceNetwork(abort), true);
assert.equal(isRetryableBinanceNetwork(new Error("fetch failed")), true);
assert.equal(isRetryableBinanceNetwork(new Error("ECONNRESET")), true);
assert.equal(isRetryableBinanceNetwork(new Error("-2019 Margin is insufficient")), false);

assert.equal(binanceRetryDelayMs(1), 400);
assert.equal(binanceRetryDelayMs(3), 1200);

console.log("  PASS  Binance retry: 5xx/429/timeout/connection; no retry on generic 4xx");
