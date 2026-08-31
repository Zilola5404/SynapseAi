import assert from "node:assert/strict";
import { parseAiSignal } from "./aiService.js";

const good = parseAiSignal({
  analysisText: "Тест",
  signal: "BUY",
  confidence: 80,
  suggestedSide: "LONG",
  suggestedLeverage: 3,
  suggestedStopLossPrice: 90,
  suggestedTakeProfitPrice: 110,
  suggestedPositionSizeUsdt: 100,
  riskLevel: "LOW",
  keyDrivers: ["RSI"],
  patternDetected: "flag",
});
assert.equal(good.ok, true);

const broken = parseAiSignal({ signal: "MAYBE", confidence: 1000 });
assert.equal(broken.ok, false);

const hold = parseAiSignal({
  analysisText: "wait",
  signal: "HOLD",
  confidence: 40,
  suggestedSide: "LONG",
  suggestedLeverage: 1,
  suggestedStopLossPrice: 1,
  suggestedTakeProfitPrice: 2,
  suggestedPositionSizeUsdt: 10,
  riskLevel: "HIGH",
  keyDrivers: [],
  patternDetected: "",
});
assert.equal(hold.ok, true);
if (hold.ok) assert.equal(hold.signal.signal, "HOLD");

console.log("  PASS  Этап 5: строгий JSON AI, битый ответ отклоняется без падения");
