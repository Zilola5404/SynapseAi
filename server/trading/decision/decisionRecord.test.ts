import assert from "node:assert/strict";
import { autoGateChecks, classifySetup, regimeAllowedForAuto } from "./tradeQuality.js";
import { buildDecisionRecord, formatDecisionTelegram, formatIdleTelegram } from "./decisionRecord.js";

assert.equal(classifySetup({ hasSignal: false, qualityScore: 4, autoGatesPass: false }), "NO_TRADE");
assert.equal(classifySetup({ hasSignal: false, qualityScore: 8, autoGatesPass: false }), "WATCH");
assert.equal(classifySetup({ hasSignal: true, grade: "A", autoGatesPass: false }), "SIGNAL");
assert.equal(classifySetup({ hasSignal: true, grade: "A+", autoGatesPass: true }), "AUTO_TRADE");

assert.equal(regimeAllowedForAuto("TRENDING"), true);
assert.equal(regimeAllowedForAuto("HIGH_VOLATILITY"), false);
assert.equal(regimeAllowedForAuto("RANGING"), false);

const gates = autoGateChecks({
  regimeAllowed: true,
  htfOk: true,
  structureOk: true,
  triggerOk: true,
  riskOk: true,
  costOk: true,
  sizeOk: true,
  noDuplicate: true,
  noKillSwitch: true,
  dataFresh: true,
  noSetupPause: true,
});
assert.equal(gates.pass, true);

const rec = buildDecisionRecord({
  symbol: "BTCUSDT",
  direction: "LONG",
  allowed: false,
  blockedReason: "TRADING_COST_TOO_HIGH",
  autoGatesPass: false,
  hasSignal: true,
  grade: "A",
  vetoes: ["Потенциальная прибыль не покрывает расходы"],
});
assert.match(formatDecisionTelegram(rec, "ru"), /СДЕЛКА НЕ ОТКРЫТА/);
assert.doesNotMatch(formatDecisionTelegram(rec, "ru"), /ГАРАНТИРОВАННО|ТОЧНО ЗАРАБОТАЕМ|100%/i);
assert.match(formatIdleTelegram({ lang: "ru", autoOn: true }), /Нет качественного сетапа/);

console.log("  PASS  tradeQuality + decision copy (no guaranteed-profit language)");
