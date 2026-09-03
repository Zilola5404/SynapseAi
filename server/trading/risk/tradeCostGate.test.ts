import assert from "node:assert/strict";
import {
  estimateTradeCosts,
  TRADE_COST_GATE,
  INSUFFICIENT_NET_EDGE,
  TP_TOO_CLOSE_TO_COVER_COSTS,
} from "./tradeCostGate.js";

const thin = estimateTradeCosts({
  entry: 100,
  stopLoss: 99,
  takeProfit: 101.5,
  quantity: 1,
});
assert.equal(Number(thin.grossRr.toFixed(2)), 1.5);
assert.ok(thin.netRr < TRADE_COST_GATE.minNetRr);
assert.equal(thin.pass, false);
assert.equal(thin.reason, INSUFFICIENT_NET_EDGE);

const wide = estimateTradeCosts({
  entry: 100,
  stopLoss: 99,
  takeProfit: 103,
  quantity: 1,
});
assert.ok(wide.grossRr >= 3);
assert.ok(wide.netRr >= TRADE_COST_GATE.minNetRr);
assert.ok(wide.expectedNet >= wide.totalCosts * TRADE_COST_GATE.minNetToCostRatio);
assert.equal(wide.pass, true);

const paperLike = estimateTradeCosts({
  entry: 78878.59,
  stopLoss: 78720.71,
  takeProfit: 79147.04,
  quantity: 0.038012,
});
assert.equal(paperLike.pass, false);
assert.equal(paperLike.reason, INSUFFICIENT_NET_EDGE);

const microTp = estimateTradeCosts({
  entry: 100,
  stopLoss: 99,
  takeProfit: 100.05,
  quantity: 1,
});
assert.ok(microTp.expectedGross <= microTp.totalCosts);
assert.equal(microTp.pass, false);
assert.equal(microTp.reason, TP_TOO_CLOSE_TO_COVER_COSTS);

console.log("  PASS  tradeCostGate: net RR, cost multiple, TP too close");
