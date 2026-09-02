import assert from "node:assert/strict";
import { summarizePaperSoak } from "./paperSoak.js";

const baseTrade = {
  symbol: "BTCUSDT",
  pnl: -7.54,
  fees: 1.2,
  sizeUsdt: 1500,
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
assert.equal(oneSl.canReopenAfterClose, false);
assert.ok(oneSl.avgSlPct > 0);
assert.ok(oneSl.feeShareOfLoss > 0);
assert.equal(oneSl.readyForTestnet, false);

const stuck = summarizePaperSoak({
  trades: Array.from({ length: 10 }, (_, i) => ({
    ...baseTrade,
    symbol: i % 2 ? "ETHUSDT" : "BTCUSDT",
    pnl: i % 3 ? 2 : -1,
    reason: i % 2 ? "TAKE_PROFIT" : "STOP_LOSS",
    fees: 1.2,
    sizeUsdt: 1500,
    exitPrice: i % 2 ? 3400 : 66900,
    entryPrice: i % 2 ? 3300 : 67420,
  })),
  positions: [{ symbol: "SOLUSDT", status: "CLOSING", closeRequestedAt: new Date(Date.now() - 120_000), isPaper: true }],
});
assert.equal(stuck.closed, 10);
assert.equal(stuck.stuckClosing, 1);
assert.equal(stuck.readyForTestnet, false);
assert.ok(stuck.blockers.includes("stuck_closing"));

const tpOnly = summarizePaperSoak({
  trades: Array.from({ length: 12 }, () => ({
    ...baseTrade,
    pnl: 3,
    reason: "TAKE_PROFIT",
    fees: 1.2,
    sizeUsdt: 1500,
    exitPrice: 68000,
    symbol: "ETHUSDT",
  })),
  positions: [],
});
assert.equal(tpOnly.tpCloses, 12);
assert.equal(tpOnly.slCloses, 0);
assert.equal(tpOnly.readyForTestnet, false);
assert.ok(tpOnly.blockers.includes("need_stop_loss"));

const dup = summarizePaperSoak({
  trades: [],
  positions: [
    { symbol: "BTCUSDT", status: "OPEN", closeRequestedAt: null, isPaper: true },
    { symbol: "BTCUSDT", status: "OPEN", closeRequestedAt: null, isPaper: true },
  ],
});
assert.deepEqual(dup.duplicateSymbols, ["BTCUSDT"]);

const mixed = Array.from({ length: 10 }, (_, i) => ({
  ...baseTrade,
  symbol: i < 2 ? "BTCUSDT" : i < 6 ? "ETHUSDT" : "SOLUSDT",
  pnl: i % 2 ? 4 : -2,
  reason: i % 2 ? "TAKE_PROFIT" : "STOP_LOSS",
  fees: 1.2,
  sizeUsdt: 1500,
  exitPrice: i % 2 ? 68000 : 66900,
}));
const ready = summarizePaperSoak({ trades: mixed, positions: [] });
assert.equal(ready.slCloses >= 1, true);
assert.equal(ready.tpCloses >= 1, true);
assert.equal(ready.canReopenAfterClose, true);
assert.equal(ready.feesConsistent, true);
assert.equal(ready.readyForTestnet, true);

const weakFees = summarizePaperSoak({
  trades: mixed.map((t) => ({ ...t, fees: 0.1 })),
  positions: [],
});
assert.equal(weakFees.readyForTestnet, false);
assert.ok(weakFees.blockers.includes("fees_inconsistent"));

console.log("  PASS  PAPER soak: 10-20 goal, SL and TP required, reopen, fees, no stuck/duplicates");
