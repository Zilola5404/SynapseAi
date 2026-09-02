import assert from "node:assert/strict";
import { evaluatePrecisionGate } from "./testnetPreflight.js";

const btc = evaluatePrecisionGate({ symbol: "BTCUSDT", price: 77000, isTestnet: true });
assert.equal(btc.ok, true);
assert.ok(btc.qty >= 0.001);
assert.equal(btc.minNotionalOk, true);

const bad = evaluatePrecisionGate({ symbol: "BTCUSDT", price: 0, isTestnet: true });
assert.ok(bad.qty >= 0);

console.log("  PASS  Testnet preflight precision gate");
