import assert from "node:assert/strict";
import { classifyBinanceError, formatBinanceError } from "./binanceErrors.js";

const ts = classifyBinanceError(400, JSON.stringify({ code: -1021, msg: "Timestamp for this request is outside of the recvWindow." }));
assert.equal(ts.kind, "TIMESTAMP");
assert.match(formatBinanceError(ts.kind, ts.message), /Рассинхрон/);

const margin = classifyBinanceError(400, JSON.stringify({ code: -2019, msg: "Margin is insufficient." }));
assert.equal(margin.kind, "INSUFFICIENT_MARGIN");

const rate = classifyBinanceError(429, "too many requests");
assert.equal(rate.kind, "RATE_LIMIT");

const key = classifyBinanceError(401, JSON.stringify({ code: -2015, msg: "Invalid API-key" }));
assert.equal(key.kind, "INVALID_KEY");
assert.match(formatBinanceError(key.kind, key.message), /demo\.binance\.com/);

console.log("  PASS  Этап 4: классификация ошибок Binance (timestamp, margin, rate limit, keys)");
