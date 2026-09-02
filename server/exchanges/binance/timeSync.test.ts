import assert from "node:assert/strict";
import { BINANCE_RECV_WINDOW, binanceTimestamp, binanceTimeOffset } from "./timeSync.js";

assert.equal(BINANCE_RECV_WINDOW, 60_000);
assert.ok(binanceTimestamp() > 1_700_000_000_000);
assert.equal(typeof binanceTimeOffset(), "number");
console.log("  PASS  Binance time sync helpers");
