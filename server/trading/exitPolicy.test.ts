import assert from "node:assert/strict";
import { selectCanonicalExit } from "./exitPolicy.js";

const noneWins = selectCanonicalExit([
  { label: "NO_TIME_EXIT", expectancyR: 0.1, maxDrawdownR: -4 },
  { label: "12h", expectancyR: 0.11, maxDrawdownR: -5 },
  { label: "24h", expectancyR: 0.2, maxDrawdownR: -6 },
  { label: "48h", expectancyR: 0.3, maxDrawdownR: -8 },
  { label: "72h", expectancyR: 0.4, maxDrawdownR: -9 },
]);
assert.equal(noneWins.id, "NO_TIME_EXIT");
assert.equal(noneWins.variant, "B");

const capWins = selectCanonicalExit([
  { label: "NO_TIME_EXIT", expectancyR: 0, maxDrawdownR: -8 },
  { label: "12h", expectancyR: 0.02, maxDrawdownR: -7 },
  { label: "24h", expectancyR: 0.08, maxDrawdownR: -5 },
  { label: "48h", expectancyR: 0.2, maxDrawdownR: -4 },
  { label: "72h", expectancyR: 0.3, maxDrawdownR: -3 },
]);
assert.equal(capWins.id, "24h");
assert.equal(capWins.variant, "A");

console.log("  PASS  Exit policy selector: parity default, shortest qualifying cap");
