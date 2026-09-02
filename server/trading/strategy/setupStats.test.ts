import assert from "node:assert/strict";
import { summarizeStrategyValidation, calibrateFactor } from "./setupStats.js";

const empty = summarizeStrategyValidation([]);
assert.equal(empty["A+"].trades, 0);
assert.equal(empty.sampleTooSmall, true);

const mixed = summarizeStrategyValidation([
  { grade: "A+", pnl: 10, fees: 1, rMultiple: 1 },
  { grade: "A+", pnl: -5, fees: 1, rMultiple: -0.5 },
  { grade: "A", pnl: 2, fees: 1, rMultiple: 0.2 },
  { grade: "A", pnl: -2, fees: 1, rMultiple: -0.2 },
  { grade: "B", pnl: -1, fees: 0.5 },
]);
assert.equal(mixed["A+"].trades, 2);
assert.equal(mixed["A+"].winRate, 0.5);
assert.equal(mixed["A+"].netPnl, 5);
assert.ok(mixed["A+"].profitFactor > 1);
assert.equal(mixed.A.trades, 2);
assert.equal(mixed.sampleTooSmall, true);

const cal = calibrateFactor(
  [
    { pnl: 10, factors: { liquidity: true } },
    { pnl: 8, factors: { liquidity: true } },
    { pnl: 6, factors: { liquidity: true } },
    { pnl: 4, factors: { liquidity: true } },
    { pnl: 2, factors: { liquidity: true } },
    { pnl: -4, factors: { liquidity: false } },
    { pnl: -3, factors: { liquidity: false } },
    { pnl: -2, factors: { liquidity: false } },
    { pnl: -1, factors: { liquidity: false } },
    { pnl: -5, factors: { liquidity: false } },
  ],
  "liquidity"
);
assert.equal(cal.improvesExpectancy, true);

console.log("  PASS  Strategy grade stats aggregator");
