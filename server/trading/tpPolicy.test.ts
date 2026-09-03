import assert from "node:assert/strict";
import { TP_SCALE_OUT, tpPolicyNote } from "./tpPolicy.js";
import { splitScaleOutQty } from "../exchanges/binance/precision.js";

assert.equal(Number((TP_SCALE_OUT[0] + TP_SCALE_OUT[1] + TP_SCALE_OUT[2]).toFixed(4)), 1);
assert.match(tpPolicyNote(), /30%/);
assert.match(tpPolicyNote(), /Stop Loss/);

const large = splitScaleOutQty("ETHUSDT", 1.0, TP_SCALE_OUT, true);
assert.ok(large);
assert.equal(large.length, 3);
assert.ok(Math.abs(large.reduce((s, q) => s + q, 0) - 1) < 0.01);

const tooSmall = splitScaleOutQty("BTCUSDT", 0.001, TP_SCALE_OUT, true);
assert.equal(tooSmall, null);

const btc = splitScaleOutQty("BTCUSDT", 0.01, TP_SCALE_OUT, true);
assert.ok(btc);
assert.equal(btc.length, 3);
assert.ok(Math.abs(btc.reduce((s, q) => s + q, 0) - 0.01) < 1e-8);
assert.ok(Math.abs(btc[0] / 0.01 - 0.3) < 0.05);
assert.ok(Math.abs(btc[1] / 0.01 - 0.3) < 0.05);

console.log("  PASS  TP policy: 30/30/40 scale-out, min-qty fallback");
