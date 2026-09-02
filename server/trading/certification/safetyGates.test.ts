import assert from "node:assert/strict";
import { formatPositionMismatch } from "../reconciliation.js";
import { isSignalExpired, priceMovedTooFar } from "../signalExplain.js";
import { MarketDataCircuit } from "../../market/MarketDataProvider.js";
import { livePositionStatus } from "../positionState.js";

assert.equal(priceMovedTooFar(100, 105, 0.8), true);
assert.equal(priceMovedTooFar(100, 100.2, 0.8), false);
assert.equal(isSignalExpired(new Date(Date.now() - 1000)), true);
assert.equal(isSignalExpired(new Date(Date.now() + 60_000)), false);

const mismatch = formatPositionMismatch({
  userId: "cmthooc6xxxx",
  symbol: "BTCUSDT",
  expected: { status: "OPEN", quantity: 0.002 },
  actual: { status: "CLOSED", quantity: 0 },
  at: new Date("2026-09-02T19:00:00.000Z"),
});
assert.match(mismatch, /POSITION MISMATCH/);
assert.match(mismatch, /BTCUSDT/);
assert.match(mismatch, /user=cmthooc6/);

assert.deepEqual(livePositionStatus, { in: ["OPEN", "CLOSING"] });

const circuit = new MarketDataCircuit();
assert.equal(circuit.dataState(), "DATA_FRESH");
circuit.recordFailure();
circuit.recordFailure();
circuit.recordFailure();
assert.equal(circuit.dataState(), "DATA_UNAVAILABLE");
assert.equal(circuit.canOpenNewTrades(), false);
circuit.recordSuccess();
assert.equal(circuit.dataState(), "DATA_FRESH");
assert.equal(circuit.canOpenNewTrades(), true);

console.log("  PASS  Safety gates: stale signal, mismatch log, kill-data circuit");
