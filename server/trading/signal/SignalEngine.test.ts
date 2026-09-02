import assert from "node:assert/strict";
import { analyzeSignal } from "../signal/SignalEngine.js";
import type { MarketSnapshot } from "../types.js";

const bull: MarketSnapshot = {
  symbol: "BTCUSDT",
  price: 110,
  trend: "BULLISH",
  rsi: 55,
  ema20: 108,
  ema50: 100,
  ema200: 90,
  macdSignal: "BULLISH_CROSS",
  atr: 2,
  volatility: "MEDIUM",
  timeframe: "1H",
};

const long = analyzeSignal(bull, { ...bull, timeframe: "15M" }, { ...bull, timeframe: "5M" });
assert.ok(long.signal);
assert.equal(long.signal?.direction, "LONG");
assert.ok((long.signal?.qualityScore || 0) >= 60);
assert.doesNotMatch(long.signal?.reasoning || "", /вероятност/i);

const extreme = analyzeSignal(bull, bull, { ...bull, volatility: "EXTREME" });
assert.equal(extreme.signal, null);
assert.ok(extreme.vetoes.length > 0);

const intoRes = analyzeSignal(
  { ...bull, nearestResistance: 110.2, lastSwingLow: 100 },
  { ...bull, timeframe: "15M" },
  { ...bull, timeframe: "5M" }
);
assert.equal(intoRes.signal, null);

console.log("  PASS  Signal engine: quality score, NO TRADE, not a win probability");
