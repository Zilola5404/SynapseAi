import assert from "node:assert/strict";
import { summarizePaperSoak } from "./paperSoak.js";

const baseTrade = {
  symbol: "BTCUSDT",
  pnl: -7.54,
  fees: 1.2,
  sizeUsdt: 250,
  entryPrice: 67420,
  exitPrice: 66900,
  reason: "STOP_LOSS",
  isPaper: true,
  closedAt: new Date(),
};

const empty = summarizePaperSoak({ trades: [], positions: [] });
assert.equal(empty.closed, 0);
assert.equal(empty.readyForTestnet, false);
assert.ok(empty.blockers.includes("need_more_trades"));

const oneSl = summarizePaperSoak({
  trades: [baseTrade],
  positions: [],
});
assert.equal(oneSl.closed, 1);
assert.equal(oneSl.slCloses, 1);
assert.equal(oneSl.open, 0);
assert.equal(oneSl.stuckClosing, 0);
assert.equal(oneSl.canReopenAfterClose, true);
assert.ok(oneSl.avgSlPct > 0);
assert.ok(oneSl.feeShareOfLoss > 0);
assert.equal(oneSl.readyForTestnet, false);

const stuck = summarizePaperSoak({
  trades: Array.from({ length: 10 }, () => ({ ...baseTrade, symbol: "ETHUSDT", pnl: 2, reason: "TAKE_PROFIT", fees: 0.5, exitPrice: 3400, entryPrice: 3300 })),
  positions: [{ symbol: "BTCUSDT", status: "CLOSING", closeRequestedAt: new Date(Date.now() - 120_000), isPaper: true }],
});
assert.equal(stuck.closed, 10);
assert.equal(stuck.stuckClosing, 1);
assert.equal(stuck.readyForTestnet, false);

const dup = summarizePaperSoak({
  trades: [],
  positions: [
    { symbol: "BTCUSDT", status: "OPEN", closeRequestedAt: null, isPaper: true },
    { symbol: "BTCUSDT", status: "OPEN", closeRequestedAt: null, isPaper: true },
  ],
});
assert.deepEqual(dup.duplicateSymbols, ["BTCUSDT"]);

const ready = summarizePaperSoak({
  trades: Array.from({ length: 12 }, () => ({ ...baseTrade, pnl: 3, reason: "TAKE_PROFIT", fees: 0.4, exitPrice: 68000 })),
  positions: [],
});
assert.equal(ready.readyForTestnet, true);
assert.equal(ready.tpCloses, 12);

console.log("  PASS  PAPER soak: 10-20 goal, SL/TP, stuck, duplicates, reopen after close");
