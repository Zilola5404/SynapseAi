import assert from "node:assert/strict";
import { assertKillSwitchSteps, KILL_SWITCH_POLICY } from "./killSwitchPolicy.js";

assert.equal(KILL_SWITCH_POLICY.scannerStopped, true);
assert.equal(KILL_SWITCH_POLICY.newOrdersBlocked, true);
assert.equal(KILL_SWITCH_POLICY.openOrdersCancelled, true);
assert.equal(KILL_SWITCH_POLICY.openPositionBehavior, "FLATTEN");
assert.equal(KILL_SWITCH_POLICY.unlockRequired, true);

const ok = assertKillSwitchSteps([
  "scanner off, locked",
  "open orders cancelled",
  "closed BTCUSDT (confirmed)",
]);
assert.equal(ok.ok, true);
assert.equal(ok.scanner, true);
assert.equal(ok.cancelled, true);

const blocked = assertKillSwitchSteps(["nothing happened"]);
assert.equal(blocked.ok, false);

console.log("  PASS  Kill switch policy: flatten + block new orders");
