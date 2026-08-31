import assert from "node:assert/strict";
import type { RiskSettings, User } from "@prisma/client";
import { sizePosition } from "./risk/PositionSizer.js";
import { evaluateRisk } from "./risk/RiskEngine.js";
import { applyPaperFill, SLIPPAGE, TAKER_FEE } from "./execution/ExecutionProvider.js";
import { paperExecution } from "./execution/PaperExecution.js";
import { canTransition, makeClientOrderId } from "./execution/orderState.js";
import { strategyEngine } from "./strategy/StrategyEngine.js";
import { roundQty, roundPrice, meetsMinNotional } from "../exchanges/binance/precision.js";
import { withSymbolLock, isLocked } from "./locks/TradeLock.js";
import type { MarketSnapshot, StrategySignal } from "./types.js";

const sized = sizePosition({
  equity: 1000,
  riskPerTradePct: 0.5,
  entry: 100,
  stopLoss: 98,
  maxLeverage: 3,
});
assert.equal(sized.sizeUsdt, 250);
assert.ok(sized.marginUsdt > 0);
assert.ok(sized.leverage <= 3);

const buy = applyPaperFill("BUY", 100, 1);
assert.equal(buy.status, "FILLED");
assert.ok(buy.fillPrice > 100);
assert.ok(Math.abs(buy.fillPrice - 100 * (1 + SLIPPAGE)) < 1e-9);
assert.ok(buy.feesUsdt > 0);
assert.ok(TAKER_FEE > 0);

const user = {
  id: "u1",
  accountLocked: false,
  scannerEnabled: true,
  autoTradeEnabled: true,
  pauseUntil: null,
  peakEquityUsdt: 10000,
  paperBalanceUsdt: 10000,
} as User;

const risk = {
  emergencyKillSwitch: false,
  maxOpenPositions: 3,
  maxDailyLossPct: 3,
  maxDrawdownPct: 8,
  riskPerTradePct: 0.5,
  maxLeverage: 3,
  maxPositionSizePct: 10,
  maxExposurePct: 30,
} as RiskSettings;

const signal: StrategySignal = {
  symbol: "ETHUSDT",
  direction: "LONG",
  confidence: 80,
  entryPrice: 3200,
  stopLoss: 3160,
  takeProfit: 3340,
  riskReward: 3.5,
  reasoning: "test",
  strategy: "TREND_MOMENTUM",
};

assert.equal(evaluateRisk({
  user,
  risk,
  signal,
  equity: 10000,
  openCount: 0,
  openExposureUsdt: 0,
  realizedPnl24h: 0,
}).allowed, true);

assert.equal(evaluateRisk({
  user: { ...user, accountLocked: true },
  risk,
  signal,
  equity: 10000,
  openCount: 0,
  openExposureUsdt: 0,
  realizedPnl24h: 0,
}).allowed, false);

assert.equal(evaluateRisk({
  user,
  risk,
  signal,
  equity: 10000,
  openCount: 3,
  openExposureUsdt: 0,
  realizedPnl24h: 0,
}).allowed, false);

assert.equal(evaluateRisk({
  user,
  risk,
  signal,
  equity: 10000,
  openCount: 0,
  openExposureUsdt: 0,
  realizedPnl24h: -400,
}).allowed, false);

assert.equal(evaluateRisk({
  user: { ...user, scannerEnabled: false, autoTradeEnabled: false },
  risk,
  signal,
  equity: 10000,
  openCount: 0,
  openExposureUsdt: 0,
  realizedPnl24h: 0,
  source: "manual",
}).allowed, true);

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
const long = strategyEngine.evaluate(bull, { ...bull, timeframe: "15M" }, { ...bull, timeframe: "5M" });
assert.ok(long);
assert.equal(long?.direction, "LONG");

const bear: MarketSnapshot = {
  ...bull,
  price: 90,
  trend: "BEARISH",
  rsi: 40,
  ema20: 92,
  ema50: 100,
  ema200: 110,
  macdSignal: "BEARISH_CROSS",
};
const short = strategyEngine.evaluate(bear, { ...bear, timeframe: "15M" }, { ...bear, timeframe: "5M" });
assert.ok(short);
assert.equal(short?.direction, "SHORT");

assert.equal(
  evaluateRisk({
    user,
    risk,
    signal,
    equity: 10000,
    openCount: 0,
    openExposureUsdt: 0,
    realizedPnl24h: 0,
    circuitOpen: true,
    circuitReason: "timeout",
  }).allowed,
  false
);

assert.equal(canTransition("NEW", "VALIDATED"), true);
assert.equal(canTransition("FILLED", "NEW"), false);
assert.equal(canTransition("SUBMITTED", "FILLED"), true);
assert.ok(makeClientOrderId("ENTRY").length <= 36);

assert.ok(roundQty("BTCUSDT", 0.0015) <= 0.0015);
assert.ok(roundPrice("BTCUSDT", 108250.37) <= 108250.37);
assert.equal(meetsMinNotional("BTCUSDT", 0.001, 108000), true);

const closeFill = await paperExecution.closeMarket({
  symbol: "ETHUSDT",
  side: "SELL",
  quantity: 1,
  markPrice: 3200,
  clientOrderId: "PAPERTEST1",
});
assert.equal(closeFill.status, "FILLED");
assert.equal(closeFill.isPaper, true);
assert.ok(closeFill.feesUsdt > 0);

await withSymbolLock("u1", "BTCUSDT", async () => {
  assert.equal(isLocked("u1", "BTCUSDT"), true);
});
assert.equal(isLocked("u1", "BTCUSDT"), false);
await assert.rejects(async () => {
  await withSymbolLock("u1", "ETHUSDT", async () => {
    await withSymbolLock("u1", "ETHUSDT", async () => undefined);
  });
});

console.log("  PASS  Trading core: sizer, paper fill, risk, strategy, orders, precision, locks");
