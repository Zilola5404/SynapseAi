import assert from "node:assert/strict";
import type { BinanceCandle } from "../../binance.js";
import type { MarketSnapshot } from "../types.js";
import { analyzeMarketContext } from "./MarketContextEngine.js";
import { analyzeVolume } from "./VolumeEngine.js";
import { scoreConfluence, gradeOf } from "./ConfluenceEngine.js";
import { analyzeMarketStructure } from "./MarketStructureEngine.js";
import { autoAllowed, tradeAllowed } from "./NoTradeEngine.js";
import { evaluateIntelligence } from "./TradingIntelligenceEngine.js";
import { detectBosChoch, findSwings } from "../../market/swings.js";

const bull: MarketSnapshot = {
  symbol: "BTCUSDT",
  price: 100,
  trend: "BULLISH",
  rsi: 55,
  ema20: 99.7,
  ema50: 99,
  ema200: 90,
  macdSignal: "BULLISH_CROSS",
  atr: 1.2,
  volatility: "MEDIUM",
  timeframe: "1H",
  relativeVolume: 1.6,
  volume: 160,
  avgVolume: 100,
  structure: "BULLISH",
};

function candle(i: number, close: number, extra: Partial<BinanceCandle> = {}): BinanceCandle {
  return {
    openTime: i * 3_600_000,
    open: close,
    high: extra.high ?? close + 0.8,
    low: extra.low ?? close - 0.8,
    close,
    volume: extra.volume ?? 10,
    closeTime: i * 3_600_000 + 3_599_000,
  };
}

const rising: BinanceCandle[] = [];
for (let i = 0; i < 60; i++) {
  const base = 70 + i * 0.5;
  rising.push(
    candle(i, base, {
      high: i % 6 === 2 ? base + 3 + i * 0.05 : base + 0.6,
      low: i % 6 === 5 ? base - 1.2 : base - 0.6,
      volume: i === 59 ? 40 : 12,
    })
  );
}
rising[rising.length - 1] = candle(59, 100.4, { high: 101, low: 99.2, volume: 40 });

assert.equal(gradeOf(14), "A+");
assert.equal(gradeOf(11), "A");
assert.equal(gradeOf(8), "B");
assert.equal(gradeOf(5), "NO_TRADE");
assert.equal(autoAllowed("A+"), true);
assert.equal(autoAllowed("A+", "TRENDING"), true);
assert.equal(autoAllowed("A+", "HIGH_VOLATILITY"), false);
assert.equal(autoAllowed("A"), false);
assert.equal(tradeAllowed("A"), true);
assert.equal(tradeAllowed("B"), false);

const vol = analyzeVolume(1.8);
assert.equal(vol.klass, "STRONG");
assert.equal(vol.confirms, true);
assert.equal(analyzeVolume(0.5).klass, "WEAK");
assert.equal(analyzeVolume(undefined).klass, "UNKNOWN");
assert.equal(analyzeVolume(undefined).confirms, false);

const riskOff = analyzeMarketContext({
  d1: { ...bull, trend: "BEARISH", volatility: "HIGH" },
  h4: { ...bull, trend: "BEARISH", volatility: "HIGH" },
  h1: { ...bull, trend: "BEARISH" },
});
assert.equal(riskOff.marketMode, "RISK_OFF");
assert.equal(riskOff.blockAltLong, true);

const scored = scoreConfluence({
  direction: "LONG",
  context: analyzeMarketContext({ d1: bull, h4: bull, h1: bull }),
  mtf: {
    daily: bull,
    h4: bull,
    h1: bull,
    m15: { ...bull, timeframe: "15M" },
    m5: { ...bull, timeframe: "5M" },
    mainTrend: "BULLISH",
    confirmOk: true,
    reasons: [],
  },
  structure: { structure: "BULLISH", lastSwingHigh: 102, lastSwingLow: 96, bos: "BULLISH", choch: "NONE", reasons: [] },
  atLevel: true,
  liquidity: {
    equalHighs: false,
    equalLows: true,
    previousHigh: 102,
    previousLow: 96,
    sweep: "LOW",
    confirmed: true,
    score: 2,
    reasons: [],
  },
  volume: vol,
  riskReward: 2.1,
});
assert.equal(scored.total, 15);
assert.equal(scored.grade, "A+");
assert.doesNotMatch(scored.lines.map((l) => l.textRu).join(" "), /вероятност/i);

const struct = analyzeMarketStructure(rising);
assert.ok(struct.lastSwingHigh > 0 || struct.lastSwingLow > 0);
const bos = detectBosChoch(rising, findSwings(rising));
assert.ok(bos.bos === "BULLISH" || bos.choch === "BULLISH" || bos.bos === "NONE");

const extreme = evaluateIntelligence({
  symbol: "ETHUSDT",
  snapshots: {
    d1: bull,
    h4: bull,
    h1: { ...bull, volatility: "EXTREME" },
    m15: { ...bull, timeframe: "15M" },
    m5: { ...bull, timeframe: "5M", volatility: "EXTREME" },
  },
  btc: {
    d1: { ...bull, trend: "BEARISH", volatility: "HIGH" },
    h4: { ...bull, trend: "BEARISH", volatility: "HIGH" },
    h1: { ...bull, trend: "BEARISH" },
  },
});
assert.equal(extreme.decision, "NO_TRADE");
assert.ok(extreme.vetoes.length > 0);

const incomplete = evaluateIntelligence({
  symbol: "BTCUSDT",
  snapshots: { h1: bull, m15: { ...bull, timeframe: "15M" }, m5: { ...bull, timeframe: "5M" } },
});
assert.equal(incomplete.decision, "NO_TRADE");

console.log("  PASS  Trading Intelligence: confluence 0-15, NO TRADE, BTC block, no fake probability");
