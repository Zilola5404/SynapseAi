import assert from "node:assert/strict";
import { FACTOR_KEYS } from "./universeWalk.js";
import { threeWaySplit } from "./mtf.js";

assert.equal(FACTOR_KEYS.length, 8);
assert.ok(FACTOR_KEYS.includes("liquidity"));
const split = threeWaySplit(Array.from({ length: 100 }, (_, i) => i), 0.5, 0.25);
assert.equal(split.train.length, 50);
assert.equal(split.validation.length, 25);
assert.equal(split.outOfSample.length, 25);
console.log("  PASS  Universe walk helpers: 50/25/25 split, confluence keys");
