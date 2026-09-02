import assert from "node:assert/strict";
import { formatPositionMismatch } from "./reconciliation.js";

const line = formatPositionMismatch({
  userId: "user-12345678",
  symbol: "ETHUSDT",
  expected: { status: "OPEN", quantity: 0.01, entryPrice: 3000 },
  actual: { status: "OPEN", quantity: 0.02, entryPrice: 3010 },
});
assert.match(line, /POSITION MISMATCH/);
assert.match(line, /ETHUSDT/);
assert.match(line, /0\.01/);
assert.match(line, /0\.02/);
console.log("  PASS  Reconciliation mismatch log format");
