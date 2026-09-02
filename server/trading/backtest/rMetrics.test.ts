import assert from "node:assert/strict";
import { computeRMetrics, evaluateSampleGate } from "./rMetrics.js";

const oneLucky = computeRMetrics([{ resultR: 3.4, pnl: 34, grade: "A+" }]);
assert.equal(oneLucky.trades, 1);
assert.ok(oneLucky.netUsdt > 30);

const gate = evaluateSampleGate({
  aPlus: 1,
  a: 38,
  oos: 0,
  historyDays: 15,
  walkForwardWindows: 0,
  oosExpectancyR: 0,
  positiveOosWindows: 0,
});
assert.equal(gate.strategyPass, false);
assert.equal(gate.sampleLabel, "HISTORY_TOO_SHORT");
assert.ok(gate.issues.includes("A+_INSUFFICIENT_SAMPLE"));
assert.ok(gate.issues.includes("OOS_NOT_VALIDATED"));

const mixed = computeRMetrics([
  { resultR: 1, pnl: 10 },
  { resultR: -0.5, pnl: -5 },
  { resultR: 0.5, pnl: 5 },
  { resultR: -1, pnl: -10 },
  { resultR: -1, pnl: -10 },
]);
assert.equal(mixed.maxConsecutiveLosses, 2);
assert.ok(mixed.expectancyR < 0);
assert.ok(mixed.maxDrawdownR < 0);

console.log("  PASS  R metrics and sample gates refuse STRATEGY PASS on tiny samples");
