import assert from "node:assert/strict";
import { classifyTradeOrigin, isStrategyTrade, originBadge } from "./tradeSource.js";

const test = classifyTradeOrigin({
  isPaperTrade: false,
  rationale: "A+ TEST_ORDER 13/15 | TEST_ORDER",
});
assert.equal(test.source, "TEST_ORDER");
assert.equal(test.environment, "TESTNET");
assert.equal(isStrategyTrade(test), false);
assert.match(originBadge(test, "ru"), /TEST TRADE/);

const auto = classifyTradeOrigin({
  isPaperTrade: true,
  rationale: `A TREND_PULLBACK\n__PLAN__${JSON.stringify({ source: "AUTO", type: "TREND_PULLBACK" })}`,
});
assert.equal(auto.source, "AUTO");
assert.equal(auto.environment, "PAPER");
assert.equal(isStrategyTrade(auto), true);

const manual = classifyTradeOrigin({
  isPaperTrade: false,
  tradingMode: "TESTNET",
  rationale: `__PLAN__${JSON.stringify({ source: "MANUAL" })}`,
});
assert.equal(manual.source, "MANUAL");

console.log("  PASS  tradeSource: TEST vs AUTO vs MANUAL");
