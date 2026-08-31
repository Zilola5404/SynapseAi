import assert from "node:assert/strict";
import { MarketDataCircuit, MarketDataProvider, futuresKlinesPath, futuresMarketDataUrl } from "./MarketDataProvider.js";
import { isBlockingPositionStatus } from "../trading/positionState.js";

const prevRoot = process.env.MARKET_DATA_API_ROOT;
const prevTestnet = process.env.MARKET_DATA_USE_TESTNET;
delete process.env.MARKET_DATA_API_ROOT;
delete process.env.MARKET_DATA_USE_TESTNET;

assert.equal(futuresMarketDataUrl("PAPER"), "https://fapi.binance.com");
assert.equal(futuresMarketDataUrl("LIVE"), "https://fapi.binance.com");
assert.equal(futuresMarketDataUrl("TESTNET"), "https://fapi.binance.com");
process.env.MARKET_DATA_USE_TESTNET = "true";
assert.equal(futuresMarketDataUrl("TESTNET"), "https://testnet.binancefuture.com");
if (prevRoot === undefined) delete process.env.MARKET_DATA_API_ROOT;
else process.env.MARKET_DATA_API_ROOT = prevRoot;
if (prevTestnet === undefined) delete process.env.MARKET_DATA_USE_TESTNET;
else process.env.MARKET_DATA_USE_TESTNET = prevTestnet;
assert.ok(futuresKlinesPath("BTCUSDT", "15m", 200).startsWith("/fapi/v1/klines"));
assert.ok(!futuresKlinesPath("BTCUSDT", "15m", 50).includes("/api/v3/"));

const cb = new MarketDataCircuit();
assert.equal(cb.degraded, false);
cb.recordFailure();
cb.recordFailure();
assert.equal(cb.degraded, false);
cb.recordFailure();
assert.equal(cb.degraded, true);
cb.recordSuccess();
assert.equal(cb.degraded, false);

let calls = 0;
const flaky = new MarketDataProvider(async () => {
  calls += 1;
  if (calls < 3) throw new Error("Connect Timeout Error");
  return new Response(JSON.stringify([[1, "1", "1", "1", "1", "1", 2]]), { status: 200 });
});
const candles = await flaky.fetchKlines({ symbol: "BTCUSDT", interval: "15m", limit: 1 });
assert.equal(calls, 3);
assert.equal(candles.length, 1);

let failCalls = 0;
const dead = new MarketDataProvider(async () => {
  failCalls += 1;
  throw new Error("Connect Timeout Error");
});
await assert.rejects(() => dead.fetchKlines({ symbol: "BTCUSDT", interval: "5m", limit: 1 }), /MARKET_DATA_UNAVAILABLE/);
assert.equal(failCalls, 3);

assert.equal(isBlockingPositionStatus("OPEN"), true);
assert.equal(isBlockingPositionStatus("CLOSING"), true);
assert.equal(isBlockingPositionStatus("CLOSED"), false);

console.log("  PASS  Market data: futures klines, retry, circuit breaker, CLOSED does not block");
