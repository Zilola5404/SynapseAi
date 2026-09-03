import assert from "node:assert/strict";
import { FACTOR_KEYS } from "./universeWalk.js";
import { classifyVeto, isRegimeOnlyBlock } from "./shadowSignal.js";
import { threeWaySplit } from "./mtf.js";

assert.equal(FACTOR_KEYS.length, 8);
assert.ok(FACTOR_KEYS.includes("liquidity"));
const split = threeWaySplit(Array.from({ length: 100 }, (_, i) => i), 0.5, 0.25);
assert.equal(split.train.length, 50);
assert.equal(split.validation.length, 25);
assert.equal(split.outOfSample.length, 25);
assert.equal(classifyVeto("No Trend Pullback or Breakout+Retest setup", "Нет сетапа"), "NO_SETUP");
assert.equal(classifyVeto("Confluence 8/15 — grade B, no trade", "класс B"), "LOW_CONFLUENCE");
assert.equal(isRegimeOnlyBlock([{ textEn: "Regime: RANGING", textRu: "Рынок в боковике" }]), true);
assert.equal(
  isRegimeOnlyBlock([
    { textEn: "Regime: RANGING", textRu: "боковике" },
    { textEn: "No Trend Pullback or Breakout+Retest setup", textRu: "Нет сетапа" },
  ]),
  false
);
console.log("  PASS  Universe walk helpers: 50/25/25 split, confluence keys, veto classes");
