import assert from "node:assert/strict";
import { closeReasonLabel, friendlyError, money, sideLabel } from "./ui/format.js";
import { tradeClosedMessage, tradeOpenedMessage } from "./messages.js";
import { matchReply } from "./ui/keyboards.js";
import { sizeSettingsScreen, sizeWhyScreen } from "./ui/sizeMenu.js";
import { signalOfferText } from "./ui/signalMenu.js";

assert.equal(sideLabel("LONG", "ru"), "Покупка 📈");
assert.equal(sideLabel("SHORT", "ru"), "Продажа 📉");
assert.equal(closeReasonLabel("STOP_LOSS", "ru"), "Сработал Stop Loss");
assert.equal(closeReasonLabel("TAKE_PROFIT", "ru"), "Достигнута цель Take Profit");
assert.equal(closeReasonLabel("MANUAL", "ru"), "Закрыта пользователем");
assert.match(money(-7.54), /\-\$7\.54/);
assert.match(friendlyError("Connect Timeout Error", "ru"), /Временно не удалось/);
assert.match(friendlyError("Просадка 50.00% >= 8%", "ru"), /Просадка/);
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
assert.equal(closeReasonLabel("MANUAL", "ru"), "Закрыта пользователем");
assert.match(tradeClosedMessage("ru", { symbol: "BTCUSDT", pnl: 18, fees: 2, reason: "TAKE_PROFIT", grossPnl: 20, entryFee: 1, exitFee: 1 }), /СДЕЛКА ЗАКРЫТА[\s\S]*Комиссия входа[\s\S]*Комиссия выхода/);
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
assert.match(
  signalOfferText("ru", {
    symbol: "BTCUSDT",
    direction: "LONG",
    confidence: 14,
    grade: "A+",
    entry: 68500,
    sl: 67800,
    tp: 69900,
    tp1: 69200,
    tp2: 69900,
    riskReward: 2,
    factors: [{ ok: true, textRu: "BTC поддерживает сценарий", textEn: "BTC supports the scenario" }],
    sizeUsdt: 2500,
    marginUsdt: 833,
    leverage: 3,
    maxRiskUsdt: 50,
    potentialProfitUsdt: 100,
    expiresAt: new Date(Date.now() + 60_000),
  }, "confirm"),
  /НАШЁЛ СЕТАП[\s\S]*ПОКУПКА[\s\S]*14 \/ 15[\s\S]*не вероятность прибыли[\s\S]*Предлагаемый размер/
);

console.log("  PASS  Telegram UX: Russian copy, friendly errors, no raw stack traces");
