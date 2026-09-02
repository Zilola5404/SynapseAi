import assert from "node:assert/strict";
import { canRunFinalize, computeTradePnl, roundTripFeeOk } from "./pnl.js";

const profit = computeTradePnl({
  side: "LONG",
  entryPrice: 100,
  exitPrice: 102,
  quantity: 10,
  entryFeeUsdt: 1,
  exitFeeUsdt: 1,
});
assert.equal(profit.grossPnl, 20);
assert.equal(profit.totalFees, 2);
assert.equal(profit.netPnl, 18);

const loss = computeTradePnl({
  side: "LONG",
  entryPrice: 100,
  exitPrice: 98,
  quantity: 10,
  entryFeeUsdt: 0.4,
  exitFeeUsdt: 0.4,
});
assert.ok(loss.netPnl < loss.grossPnl);
assert.equal(Number(loss.netPnl.toFixed(2)), -20.8);

const short = computeTradePnl({
  side: "SHORT",
  entryPrice: 100,
  exitPrice: 97,
  quantity: 2,
  entryFeeUsdt: 0.08,
  exitFeeUsdt: 0.08,
});
assert.equal(short.grossPnl, 6);
assert.equal(Number(short.netPnl.toFixed(2)), 5.84);

assert.equal(canRunFinalize(true), false);
assert.equal(canRunFinalize(false), true);
assert.equal(roundTripFeeOk(1000, 0.8), true);
assert.equal(roundTripFeeOk(1000, 0.3), false);

console.log("  PASS  PnL: gross - entry fee - exit fee = net; finalize is not skipped without history");
