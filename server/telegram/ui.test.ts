import assert from "node:assert/strict";
import { closeReasonLabel, friendlyError, money, sideLabel } from "./ui/format.js";
import { tradeClosedMessage, tradeOpenedMessage } from "./messages.js";
import { matchReply } from "./ui/keyboards.js";

assert.equal(sideLabel("LONG", "ru"), "Покупка 📈");
assert.equal(sideLabel("SHORT", "ru"), "Продажа 📉");
assert.equal(closeReasonLabel("STOP_LOSS", "ru"), "Сработал Stop Loss");
assert.equal(closeReasonLabel("TAKE_PROFIT", "ru"), "Достигнута цель Take Profit");
assert.match(money(-7.54), /\-\$7\.54/);
assert.match(friendlyError("Connect Timeout Error", "ru"), /Временно не удалось/);
assert.doesNotMatch(friendlyError("Connect Timeout Error", "ru"), /ConnectTimeout|api\.binance/);
assert.match(tradeOpenedMessage("ru", { symbol: "BTCUSDT", side: "LONG", entry: 67420, sl: 66900, tp: 68500, auto: true }), /СДЕЛКА ОТКРЫТА/);
assert.match(tradeClosedMessage("ru", { symbol: "BTCUSDT", pnl: -7.54, fees: 1.2, reason: "STOP_LOSS" }), /Сработал Stop Loss/);
assert.equal(matchReply("▶️ Старт", "ru"), "start_bot");
assert.equal(matchReply("❓ Помощь", "ru"), "help");

console.log("  PASS  Telegram UX: Russian copy, friendly errors, no raw stack traces");
