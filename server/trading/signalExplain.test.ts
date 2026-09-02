import assert from "node:assert/strict";
import {
  isSignalExpired,
  priceMovedTooFar,
  signalStrength,
  signalStrengthLabel,
} from "./signalExplain.js";

assert.equal(signalStrength(40), "weak");
assert.equal(signalStrength(60), "medium");
assert.equal(signalStrength(78), "strong");
assert.equal(signalStrength(90), "very_strong");
assert.match(signalStrengthLabel(78, "ru"), /Сильный сетап/);
assert.equal(isSignalExpired(new Date(Date.now() - 1000)), true);
assert.equal(isSignalExpired(new Date(Date.now() + 60_000)), false);
assert.equal(priceMovedTooFar(100, 100.5, 0.8), false);
assert.equal(priceMovedTooFar(100, 102, 0.8), true);

console.log("  PASS  Signals: strength scale, expiry, price drift");
