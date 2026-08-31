import assert from "node:assert/strict";
import { canTransition } from "./execution/orderState.js";
import { nextTrailingStop, TRAIL_SEQUENCE } from "./execution/trailing.js";
import { roundQty, meetsMinNotional, getSymbolFilters } from "../exchanges/binance/precision.js";

assert.equal(canTransition("SUBMITTED", "ACKNOWLEDGED"), true);
assert.equal(canTransition("ACKNOWLEDGED", "FILLED"), true);
assert.equal(canTransition("ACKNOWLEDGED", "PARTIALLY_FILLED"), true);
assert.equal(canTransition("NEW", "ACKNOWLEDGED"), false);
assert.equal(canTransition("PROTECTED", "CLOSED"), true);

const trail = nextTrailingStop({
  side: "LONG",
  entryPrice: 100,
  markPrice: 104,
  currentStop: 98,
  trailingPct: 1.5,
  activateProfitPct: 2,
});
assert.ok(trail);
assert.ok(trail.nextStop > 98);
assert.ok(trail.nextStop < 104);

const noTrail = nextTrailingStop({
  side: "LONG",
  entryPrice: 100,
  markPrice: 101,
  currentStop: 98,
  trailingPct: 1.5,
  activateProfitPct: 2,
});
assert.equal(noTrail, null);

assert.deepEqual([...TRAIL_SEQUENCE], ["PLACE_NEW_SL", "CONFIRM_NEW_SL", "CANCEL_OLD_SL"]);

const f = getSymbolFilters("ETHUSDT", true);
assert.ok(f.maxQty > f.minQty);
assert.ok(meetsMinNotional("ETHUSDT", 1, 2000, true));
assert.equal(roundQty("ETHUSDT", 0, true), 0);

console.log("  PASS  Execution layer: ACKNOWLEDGED, trailing sequence, precision maxQty");
