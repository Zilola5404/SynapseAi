import assert from "node:assert/strict";
import { classifyTestOrderFail, redactSecrets, testOrderFailedMessage } from "./testOrderError.js";

assert.equal(classifyTestOrderFail('{"code":-2019,"msg":"Margin is insufficient."}'), "INSUFFICIENT_BALANCE");
assert.equal(classifyTestOrderFail('Binance HTTP 400 {"code":-4164,"msg":"Order\'s notional must be no smaller than 100"}'), "MIN_NOTIONAL");
assert.equal(classifyTestOrderFail('{"code":-1013,"msg":"LOT_SIZE"}'), "LOT_SIZE");
assert.equal(classifyTestOrderFail('{"code":-1111,"msg":"PRICE_FILTER"}'), "PRICE_FILTER");
assert.equal(classifyTestOrderFail("BTCUSDT already has an OPEN position"), "POSITION_ALREADY_EXISTS");
assert.equal(classifyTestOrderFail("Connect Timeout Error"), "NETWORK_TIMEOUT");
assert.equal(classifyTestOrderFail('{"code":-2015,"msg":"Invalid API-key"}'), "INVALID_API_KEY");
assert.match(testOrderFailedMessage("ru", "Margin is insufficient"), /Тестовая сделка не была открыта/);
assert.match(testOrderFailedMessage("ru", 'notional must be no smaller than 100'), /меньше минимального/);
assert.match(testOrderFailedMessage("ru", 'notional must be no smaller than 100'), /изменить размер сделки/);
assert.doesNotMatch(testOrderFailedMessage("ru", "BINANCE_API_SECRET=abc123"), /abc123/);
assert.match(redactSecrets("BINANCE_API_KEY=abcd SECRET=x"), /\[redacted\]/);

console.log("  PASS  testOrderError mapping (no secrets)");
