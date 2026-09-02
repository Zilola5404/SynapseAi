import assert from "node:assert/strict";
import { closeReasonLabel, friendlyError, money, sideLabel } from "./ui/format.js";
import { tradeClosedMessage, tradeOpenedMessage } from "./messages.js";
import { matchReply } from "./ui/keyboards.js";
import { sizeSettingsScreen, sizeWhyScreen } from "./ui/sizeMenu.js";

assert.equal(sideLabel("LONG", "ru"), "Покупка 📈");
assert.equal(sideLabel("SHORT", "ru"), "Продажа 📉");
assert.equal(closeReasonLabel("STOP_LOSS", "ru"), "Сработал Stop Loss");
assert.equal(closeReasonLabel("TAKE_PROFIT", "ru"), "Достигнута цель Take Profit");
assert.match(money(-7.54), /\-\$7\.54/);
assert.match(friendlyError("Connect Timeout Error", "ru"), /Временно не удалось/);
assert.doesNotMatch(friendlyError("Connect Timeout Error", "ru"), /ConnectTimeout|api\.binance/);
assert.match(
  tradeOpenedMessage("ru", {
    symbol: "BTCUSDT",
    side: "LONG",
    entry: 67420,
    sl: 66900,
    tp: 68500,
    auto: true,
    sizeUsdt: 100,
    marginUsdt: 50,
    leverage: 2,
    quantity: 0.00145,
    maxRiskUsdt: 5,
  }),
  /Размер сделки: \$100\.00[\s\S]*Использовано средств: \$50\.00[\s\S]*Плечо: x2[\s\S]*Максимальный риск по сделке: \$5\.00/
);
assert.match(tradeClosedMessage("ru", { symbol: "BTCUSDT", pnl: -7.54, fees: 1.2, reason: "STOP_LOSS" }), /Сработал Stop Loss/);
assert.equal(matchReply("▶️ Старт", "ru"), "start_bot");
assert.equal(matchReply("❓ Помощь", "ru"), "help");
assert.match(sizeSettingsScreen("ru", {
  positionSizeMode: "AUTO",
  riskPerTradePct: 0.5,
  maxLeverage: 3,
  maxNotionalUsdt: 500,
  fixedNotionalUsdt: 50,
}).text, /Размер сделок[\s\S]*Автоматический/);
assert.match(sizeWhyScreen("ru", {
  mode: "CAPPED",
  equity: 1000,
  riskPct: 1,
  riskAmount: 10,
  stopDistPct: 2,
  calculatedSizeUsdt: 500,
  maxMarginUsdt: 100,
  maxNotionalUsdt: 300,
  fixedNotionalUsdt: 50,
  cappedBy: "max_notional",
  quantity: 0.004,
  sizeUsdt: 300,
  marginUsdt: 150,
  leverage: 2,
  maxLossUsdt: 6,
}).text, /РАСЧЁТ РАЗМЕРА СДЕЛКИ[\s\S]*Итоговый размер:[\s\S]*\$300\.00/);

console.log("  PASS  Telegram UX: Russian copy, friendly errors, no raw stack traces");
