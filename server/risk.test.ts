import assert from "node:assert/strict";
import { validateOrderRisk, evaluatePositionEmergency, type ServerRiskSettings } from "./risk.js";

const risk: ServerRiskSettings = {
  maxDailyLossPct: 5,
  maxDrawdownPct: 8,
  maxPositionSizePct: 10,
  maxLeverage: 10,
  maxOpenPositions: 3,
  enableTrailingStop: true,
  trailingStopPct: 1.5,
  emergencyKillSwitch: false,
};

const base = {
  symbol: "BTCUSDT",
  side: "BUY" as const,
  marginUsdt: 100,
  leverage: 5,
  accountEquity: 10000,
  activePositionsCount: 0,
  realizedPnL24h: 0,
  riskSettings: risk,
};

assert.equal(validateOrderRisk(base).allowed, true);

assert.equal(validateOrderRisk({ ...base, riskSettings: { ...risk, emergencyKillSwitch: true } }).allowed, false);
assert.equal(validateOrderRisk({ ...base, leverage: 50 }).allowed, false);
assert.equal(validateOrderRisk({ ...base, activePositionsCount: 3 }).allowed, false);
assert.equal(validateOrderRisk({ ...base, marginUsdt: 2000 }).allowed, false);
assert.equal(validateOrderRisk({ ...base, realizedPnL24h: -600 }).allowed, false);
assert.equal(
  validateOrderRisk({ ...base, peakEquityUsdt: 10000, currentEquityUsdt: 9000 }).allowed,
  false,
  "drawdown 10% > 8%"
);
assert.equal(validateOrderRisk({ ...base, peakEquityUsdt: 10000, currentEquityUsdt: 9600 }).allowed, true);

let blocked = 0;
for (let i = 0; i < 10; i++) {
  const r = validateOrderRisk({ ...base, activePositionsCount: i });
  if (!r.allowed) blocked += 1;
}
assert.equal(blocked, 7, "при лимите 3 из 10 заявок сервер отклоняет 7");

const sl = evaluatePositionEmergency(
  { symbol: "BTCUSDT", side: "LONG", entryPrice: 100, currentPrice: 98, sizeUsdt: 500, marginUsdt: 100, stopLossPrice: 99, takeProfitPrice: 110 },
  risk
);
assert.equal(sl.shouldClose, true);
assert.equal(sl.reason, "STOP_LOSS");

console.log("  PASS  Этап 3: kill switch, leverage, positions cap, daily loss, drawdown, SL");
