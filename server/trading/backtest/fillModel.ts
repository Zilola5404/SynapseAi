import { TAKER_FEE, SLIPPAGE } from "../execution/ExecutionProvider.js";
import { INTEL } from "../intelligence/config.js";
import { computeTradePnl } from "../pnl.js";
import type { BinanceCandle } from "../../binance.js";
import type { StrategySignal } from "../types.js";
import { BACKTEST } from "./config.js";

export type FundingPoint = { time: number; rate: number };
export type ExitReason = "SL" | "TP1" | "TP2" | "TP3" | "TIME" | "EOD";

export type FillResult = {
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number | null;
  exit: number;
  exitReason: ExitReason;
  timeInTradeMs: number;
  maeR: number;
  mfeR: number;
  resultR: number;
  pnl: number;
  fees: number;
  funding: number;
  remainingFrac: number;
  ambiguousSlTpBar: boolean;
  tpHits: number;
  exitIndex: number;
  entryIndex: number;
  qty: number;
};

function hitSl(bar: BinanceCandle, dir: 1 | -1, sl: number) {
  return dir === 1 ? bar.low <= sl : bar.high >= sl;
}

function hitTp(bar: BinanceCandle, dir: 1 | -1, tp: number) {
  return dir === 1 ? bar.high >= tp : bar.low <= tp;
}

function tpLabel(hits: number): ExitReason {
  if (hits >= 3) return "TP3";
  if (hits === 2) return "TP2";
  return "TP1";
}

function fundingCash(dir: 1 | -1, qty: number, mark: number, entryTime: number, exitTime: number, rates: FundingPoint[]) {
  let sum = 0;
  for (const f of rates) {
    if (f.time > entryTime && f.time <= exitTime) {
      sum += -dir * f.rate * qty * mark;
    }
  }
  return sum;
}

/**
 * Conservative execution model:
 * - Entry: next bar open ± slippage (no same-bar fill).
 * - Same bar touches SL and the next TP: SL wins (worst-case).
 * - Partial TP 30/30/40 from INTEL.scaleOut (read-only).
 * - TIME if a finite hold cap is hit; EOD if the series ends first. Default cap is canonical EXIT_POLICY (no time kill).
 */
export function simulateFill(
  m5: BinanceCandle[],
  signalIndex: number,
  signal: StrategySignal,
  rates: FundingPoint[] = [],
  maxHoldBars: number = BACKTEST.maxHoldBars
): FillResult | null {
  const entryIndex = signalIndex + 1;
  const fillBar = m5[entryIndex];
  if (!fillBar) return null;
  const dir: 1 | -1 = signal.direction === "LONG" ? 1 : -1;
  const entry = fillBar.open * (1 + (dir === 1 ? SLIPPAGE : -SLIPPAGE));
  const sl = signal.stopLoss;
  const tp1 = signal.takeProfit1 || signal.takeProfit;
  const tp2 = signal.takeProfit2 || signal.takeProfit;
  const tp3 = signal.takeProfit3 && signal.takeProfit3 > 0 ? signal.takeProfit3 : null;
  const risk = Math.abs(entry - sl);
  if (risk <= 0) return null;
  if (dir === 1 && entry <= sl) return null;
  if (dir === -1 && entry >= sl) return null;

  const qtyUsd = (BACKTEST.equity * BACKTEST.riskPct * entry) / risk;
  const qty = qtyUsd / entry;
  if (qty <= 0) return null;

  const tps = [tp1, tp2, tp3].filter((n): n is number => typeof n === "number" && n > 0);
  const scale = INTEL.scaleOut;
  let remaining = 1;
  let tpHits = 0;
  let weightedExit = 0;
  let closedFrac = 0;
  let fees = 0;
  let ambiguousSlTpBar = false;
  let maeR = 0;
  let mfeR = 0;
  let exitReason: ExitReason = "TIME";
  let exitPrice = fillBar.close;
  let exitIndex = entryIndex;
  const entryTime = fillBar.openTime;
  const lastJ = Math.min(entryIndex + maxHoldBars, m5.length - 1);

  const addLeg = (price: number, frac: number) => {
    const q = qty * frac;
    fees += entry * q * TAKER_FEE + price * q * TAKER_FEE;
    weightedExit += price * frac;
    closedFrac += frac;
    remaining = Math.max(0, remaining - frac);
  };

  for (let j = entryIndex; j <= lastJ; j++) {
    const bar = m5[j];
    const adverse = dir === 1 ? bar.low - entry : entry - bar.high;
    const favorable = dir === 1 ? bar.high - entry : entry - bar.low;
    maeR = Math.min(maeR, adverse / risk);
    mfeR = Math.max(mfeR, favorable / risk);
    exitIndex = j;
    exitPrice = bar.close;

    const slNow = hitSl(bar, dir, sl);
    const nextTp = tps[tpHits];
    const tpNow = nextTp != null && hitTp(bar, dir, nextTp);

    if (slNow && tpNow) {
      ambiguousSlTpBar = true;
      addLeg(sl, remaining);
      exitPrice = sl;
      exitReason = "SL";
      remaining = 0;
      break;
    }
    if (slNow) {
      addLeg(sl, remaining);
      exitPrice = sl;
      exitReason = "SL";
      remaining = 0;
      break;
    }
    if (tpNow && nextTp != null) {
      const isLastTp = tpHits >= tps.length - 1;
      const frac = isLastTp ? remaining : Math.min(remaining, scale[Math.min(tpHits, scale.length - 1)]);
      addLeg(nextTp, frac);
      tpHits += 1;
      exitPrice = nextTp;
      exitReason = tpLabel(tpHits);
      if (remaining <= 1e-12) {
        remaining = 0;
        break;
      }
    }
  }

  if (remaining > 1e-12) {
    addLeg(exitPrice, remaining);
    remaining = 0;
    const capIndex = entryIndex + maxHoldBars;
    const hitCap = capIndex <= m5.length - 1 && exitIndex >= capIndex;
    exitReason = hitCap ? "TIME" : "EOD";
  }

  const vwap = closedFrac > 0 ? weightedExit / closedFrac : exitPrice;
  const exitTime = m5[exitIndex]?.closeTime || m5[exitIndex]?.openTime || entryTime;
  const funding = fundingCash(dir, qty, entry, entryTime, exitTime, rates);
  const pnl = computeTradePnl({
    side: signal.direction,
    entryPrice: entry,
    exitPrice: vwap,
    quantity: qty,
    entryFeeUsdt: fees / 2,
    exitFeeUsdt: fees / 2,
    fundingUsdt: funding,
  });
  const resultR = qty * risk > 0 ? pnl.netPnl / (qty * risk) : 0;

  return {
    entry,
    sl,
    tp1,
    tp2,
    tp3,
    exit: vwap,
    exitReason,
    timeInTradeMs: Math.max(0, exitTime - entryTime),
    maeR,
    mfeR,
    resultR,
    pnl: pnl.netPnl,
    fees: pnl.totalFees,
    funding: pnl.fundingUsdt,
    remainingFrac: 0,
    ambiguousSlTpBar,
    tpHits,
    exitIndex,
    entryIndex,
    qty,
  };
}
