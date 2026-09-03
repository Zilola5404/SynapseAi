import assert from "node:assert/strict";
import { detectLossCluster, nextUtcMidnight } from "./lossCluster.js";

assert.equal(
  detectLossCluster([
    { symbol: "BTCUSDT", side: "LONG", pnl: -5, regime: "TRENDING" },
    { symbol: "BTCUSDT", side: "LONG", pnl: -3, regime: "TRENDING" },
    { symbol: "BTCUSDT", side: "LONG", pnl: -2, regime: "TRENDING" },
  ])?.symbol,
  "BTCUSDT"
);

assert.equal(
  detectLossCluster([
    { symbol: "BTCUSDT", side: "LONG", pnl: -5 },
    { symbol: "ETHUSDT", side: "LONG", pnl: -3 },
    { symbol: "BTCUSDT", side: "LONG", pnl: -2 },
  ]),
  null
);

assert.equal(
  detectLossCluster([
    { symbol: "BTCUSDT", side: "LONG", pnl: -5, regime: "TRENDING" },
    { symbol: "BTCUSDT", side: "LONG", pnl: -3, regime: "HIGH_VOLATILITY" },
    { symbol: "BTCUSDT", side: "LONG", pnl: -2, regime: "TRENDING" },
  ]),
  null
);

const mid = nextUtcMidnight(new Date("2026-09-03T15:00:00Z"));
assert.equal(mid.toISOString(), "2026-09-04T00:00:00.000Z");

console.log("  PASS  lossCluster + nextUtcMidnight");
