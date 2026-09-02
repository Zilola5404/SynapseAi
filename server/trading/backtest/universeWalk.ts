import { toSnapshot } from "../../market/TechnicalAnalysis.js";
import { fetchKlinesPaged } from "../../market/klinesPaged.js";
import { strategyEngine } from "../strategy/StrategyEngine.js";
import { TAKER_FEE, SLIPPAGE } from "../execution/ExecutionProvider.js";
import { candlesAtOrBefore, threeWaySplit } from "./mtf.js";
import { SCAN_UNIVERSE } from "../intelligence/config.js";
import type { BinanceCandle } from "../../binance.js";
import type { StrategySignal } from "../types.js";

export const FACTOR_KEYS = ["btc", "h4", "structure", "level", "liquidity", "bos", "volume", "rr"] as const;
export type FactorKey = (typeof FACTOR_KEYS)[number];

export type WalkTrade = {
  symbol: string;
  t: number;
  grade: "A+" | "A" | "B" | string;
  pnl: number;
  fees: number;
  rMultiple: number;
  exit: "SL" | "TP" | "TIME";
  bucket: "train" | "validation" | "oos";
  factors: Record<string, boolean>;
};

export type SymbolPack = {
  symbol: string;
  d1: BinanceCandle[];
  h4: BinanceCandle[];
  h1: BinanceCandle[];
  m15: BinanceCandle[];
  m5: BinanceCandle[];
  btcD1: BinanceCandle[];
  btcH4: BinanceCandle[];
  btcH1: BinanceCandle[];
};

export async function loadSymbolPack(symbol: string): Promise<SymbolPack> {
  const [d1, h4, h1, m15, m5, btcD1, btcH4, btcH1] = await Promise.all([
    fetchKlinesPaged(symbol, "1d", 400),
    fetchKlinesPaged(symbol, "4h", 500),
    fetchKlinesPaged(symbol, "1h", 1000),
    fetchKlinesPaged(symbol, "15m", 1500),
    fetchKlinesPaged(symbol, "5m", 4500),
    symbol === "BTCUSDT"
      ? Promise.resolve([])
      : fetchKlinesPaged("BTCUSDT", "1d", 400),
    symbol === "BTCUSDT"
      ? Promise.resolve([])
      : fetchKlinesPaged("BTCUSDT", "4h", 500),
    symbol === "BTCUSDT"
      ? Promise.resolve([])
      : fetchKlinesPaged("BTCUSDT", "1h", 1000),
  ]);
  return {
    symbol,
    d1,
    h4,
    h1,
    m15,
    m5,
    btcD1: symbol === "BTCUSDT" ? d1 : btcD1,
    btcH4: symbol === "BTCUSDT" ? h4 : btcH4,
    btcH1: symbol === "BTCUSDT" ? h1 : btcH1,
  };
}

function simulateFill(m5: BinanceCandle[], i: number, signal: StrategySignal) {
  const entry = m5[i].close * (1 + (signal.direction === "LONG" ? SLIPPAGE : -SLIPPAGE));
  const risk = Math.abs(entry - signal.stopLoss);
  if (risk <= 0) return null;
  const qtyUsd = (10000 * 0.005 * entry) / risk;
  const qty = qtyUsd / entry;
  let exit = m5[i + 1]?.close || entry;
  let reason: "SL" | "TP" | "TIME" = "TIME";
  for (let j = i + 1; j < Math.min(i + 24, m5.length); j++) {
    if (signal.direction === "LONG") {
      if (m5[j].low <= signal.stopLoss) {
        exit = signal.stopLoss;
        reason = "SL";
        break;
      }
      if (m5[j].high >= signal.takeProfit) {
        exit = signal.takeProfit;
        reason = "TP";
        break;
      }
    } else {
      if (m5[j].high >= signal.stopLoss) {
        exit = signal.stopLoss;
        reason = "SL";
        break;
      }
      if (m5[j].low <= signal.takeProfit) {
        exit = signal.takeProfit;
        reason = "TP";
        break;
      }
    }
    exit = m5[j].close;
  }
  const dir = signal.direction === "LONG" ? 1 : -1;
  const fees = entry * qty * TAKER_FEE + exit * qty * TAKER_FEE;
  const pnl = dir * (exit - entry) * qty - fees;
  const rMultiple = dir * (exit - entry) / risk;
  return { pnl, fees, rMultiple, reason, qty };
}

export function walkSlice(
  pack: SymbolPack,
  startIndex: number,
  endIndex: number,
  bucket: WalkTrade["bucket"],
  step = 6
): WalkTrade[] {
  const trades: WalkTrade[] = [];
  for (let i = startIndex; i < endIndex - 5; i += step) {
    const t = pack.m5[i].closeTime || pack.m5[i].openTime;
    const slice = {
      d1: candlesAtOrBefore(pack.d1, t),
      h4: candlesAtOrBefore(pack.h4, t),
      h1: candlesAtOrBefore(pack.h1, t),
      m15: candlesAtOrBefore(pack.m15, t),
      m5: pack.m5.slice(0, i + 1),
    };
    const h1 = toSnapshot(pack.symbol, slice.h1, "1H");
    const m15 = toSnapshot(pack.symbol, slice.m15, "15M");
    const m5 = toSnapshot(pack.symbol, slice.m5, "5M");
    if (!h1 || !m15 || !m5) continue;
    const decision = strategyEngine.analyzeBundle({
      symbol: pack.symbol,
      snapshots: {
        d1: toSnapshot(pack.symbol, slice.d1, "1D"),
        h4: toSnapshot(pack.symbol, slice.h4, "4H"),
        h1,
        m15,
        m5,
      },
      candles: slice,
      btc: {
        d1: toSnapshot("BTCUSDT", candlesAtOrBefore(pack.btcD1, t), "1D"),
        h4: toSnapshot("BTCUSDT", candlesAtOrBefore(pack.btcH4, t), "4H"),
        h1: toSnapshot("BTCUSDT", candlesAtOrBefore(pack.btcH1, t), "1H"),
      },
    });
    const signal = decision.signal;
    if (!signal) continue;
    const fill = simulateFill(pack.m5, i, signal);
    if (!fill) continue;
    const factors: Record<string, boolean> = {};
    for (const line of signal.scoreLines || []) {
      factors[line.key] = Boolean(line.ok);
    }
    trades.push({
      symbol: pack.symbol,
      t,
      grade: signal.setupGrade || "A",
      pnl: fill.pnl,
      fees: fill.fees,
      rMultiple: fill.rMultiple,
      exit: fill.reason,
      bucket,
      factors,
    });
    i += 8;
  }
  return trades;
}

export function walkPack(pack: SymbolPack, step = 6): WalkTrade[] {
  const start = 120;
  if (pack.m5.length < start + 40) return [];
  const body = pack.m5.slice(start);
  const split = threeWaySplit(body, 0.5, 0.25);
  const trainEnd = start + split.train.length;
  const valEnd = trainEnd + split.validation.length;
  return [
    ...walkSlice(pack, start, trainEnd, "train", step),
    ...walkSlice(pack, trainEnd, valEnd, "validation", step),
    ...walkSlice(pack, valEnd, pack.m5.length, "oos", step),
  ];
}

export async function runUniverseWalk(symbols: readonly string[] = SCAN_UNIVERSE, step = 6) {
  const all: WalkTrade[] = [];
  const perSymbol: Record<string, number> = {};
  for (const symbol of symbols) {
    const pack = await loadSymbolPack(symbol);
    const rows = walkPack(pack, step);
    perSymbol[symbol] = rows.length;
    all.push(...rows);
  }
  return { trades: all, perSymbol, step, noFutureData: true, split: "50/25/25 by 5m time" };
}
