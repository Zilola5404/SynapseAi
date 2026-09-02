import { fetchBinanceKlines } from "../../binance.js";
import { toSnapshot } from "../../market/TechnicalAnalysis.js";
import { strategyEngine } from "../strategy/StrategyEngine.js";
import { TAKER_FEE, SLIPPAGE } from "../execution/ExecutionProvider.js";
import { candlesAtOrBefore, threeWaySplit } from "./mtf.js";
import type { BinanceCandle } from "../../binance.js";
import type { StrategySignal } from "../types.js";

type SimTrade = { pnl: number; t: number; bucket: "train" | "validation" | "oos" };

function simulateFromM5(params: {
  symbol: string;
  d1: BinanceCandle[];
  h4: BinanceCandle[];
  h1: BinanceCandle[];
  m15: BinanceCandle[];
  m5: BinanceCandle[];
  btcD1: BinanceCandle[];
  btcH4: BinanceCandle[];
  btcH1: BinanceCandle[];
  startIndex: number;
  endIndex: number;
  bucket: SimTrade["bucket"];
  equityStart: number;
}): { trades: SimTrade[]; equity: number; fees: number; maxDd: number } {
  let equity = params.equityStart;
  let peak = params.equityStart;
  let fees = 0;
  let maxDd = 0;
  const trades: SimTrade[] = [];

  for (let i = params.startIndex; i < params.endIndex - 5; i++) {
    const t = params.m5[i].closeTime || params.m5[i].openTime;
    const slice = {
      d1: candlesAtOrBefore(params.d1, t),
      h4: candlesAtOrBefore(params.h4, t),
      h1: candlesAtOrBefore(params.h1, t),
      m15: candlesAtOrBefore(params.m15, t),
      m5: params.m5.slice(0, i + 1),
    };
    const btc = {
      d1: toSnapshot("BTCUSDT", candlesAtOrBefore(params.btcD1, t), "1D"),
      h4: toSnapshot("BTCUSDT", candlesAtOrBefore(params.btcH4, t), "4H"),
      h1: toSnapshot("BTCUSDT", candlesAtOrBefore(params.btcH1, t), "1H"),
    };
    const h1 = toSnapshot(params.symbol, slice.h1, "1H");
    const m15 = toSnapshot(params.symbol, slice.m15, "15M");
    const m5 = toSnapshot(params.symbol, slice.m5, "5M");
    if (!h1 || !m15 || !m5) continue;
    const signal = strategyEngine.analyzeBundle({
      symbol: params.symbol,
      snapshots: {
        d1: toSnapshot(params.symbol, slice.d1, "1D"),
        h4: toSnapshot(params.symbol, slice.h4, "4H"),
        h1,
        m15,
        m5,
      },
      candles: slice,
      btc,
    }).signal;
    if (!signal) continue;
    const fill = simulateTrade(params.m5, i, signal);
    if (!fill) continue;
    equity += fill.pnl;
    fees += fill.fee;
    peak = Math.max(peak, equity);
    maxDd = Math.max(maxDd, peak > 0 ? ((peak - equity) / peak) * 100 : 0);
    trades.push({ pnl: fill.pnl, t, bucket: params.bucket });
    i += 8;
  }
  return { trades, equity, fees, maxDd };
}

function simulateTrade(m5: BinanceCandle[], i: number, signal: StrategySignal) {
  const entry = m5[i].close * (1 + (signal.direction === "LONG" ? SLIPPAGE : -SLIPPAGE));
  const risk = Math.abs(entry - signal.stopLoss) / entry;
  if (risk <= 0) return null;
  const qtyUsd = (10000 * 0.005) / risk;
  const qty = qtyUsd / entry;
  let exit = m5[i + 1]?.close || entry;
  for (let j = i + 1; j < Math.min(i + 24, m5.length); j++) {
    if (signal.direction === "LONG") {
      if (m5[j].low <= signal.stopLoss) {
        exit = signal.stopLoss;
        break;
      }
      if (m5[j].high >= signal.takeProfit) {
        exit = signal.takeProfit;
        break;
      }
    } else {
      if (m5[j].high >= signal.stopLoss) {
        exit = signal.stopLoss;
        break;
      }
      if (m5[j].low <= signal.takeProfit) {
        exit = signal.takeProfit;
        break;
      }
    }
    exit = m5[j].close;
  }
  const dir = signal.direction === "LONG" ? 1 : -1;
  const fee = entry * qty * TAKER_FEE + exit * qty * TAKER_FEE;
  const pnl = dir * (exit - entry) * qty - fee;
  return { pnl, fee };
}

function stats(trades: SimTrade[]) {
  const n = trades.length;
  if (!n) {
    return { trades: 0, winRate: 0, profitFactor: null as number | null, expectancy: 0, averageWin: 0, averageLoss: 0, net: 0 };
  }
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl < 0);
  const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  return {
    trades: n,
    winRate: Number(((wins.length / n) * 100).toFixed(1)),
    profitFactor: grossLoss > 0 ? Number((grossWin / grossLoss).toFixed(2)) : null,
    expectancy: Number((trades.reduce((s, t) => s + t.pnl, 0) / n).toFixed(2)),
    averageWin: wins.length ? Number((grossWin / wins.length).toFixed(2)) : 0,
    averageLoss: losses.length ? Number((grossLoss / losses.length).toFixed(2)) : 0,
    net: Number(trades.reduce((s, t) => s + t.pnl, 0).toFixed(2)),
  };
}

export async function runHistoricalBacktest(params: {
  symbol: string;
  interval?: string;
  limit?: number;
}) {
  const symbol = params.symbol;
  const [d1p, h4p, h1p, m15p, m5p, btcD1p, btcH4p, btcH1p] = await Promise.all([
    fetchBinanceKlines(symbol, "1d", 400, false),
    fetchBinanceKlines(symbol, "4h", 500, false),
    fetchBinanceKlines(symbol, "1h", Math.min(params.limit || 500, 1000), false),
    fetchBinanceKlines(symbol, "15m", 1000, false),
    fetchBinanceKlines(symbol, "5m", 1000, false),
    fetchBinanceKlines("BTCUSDT", "1d", 400, false),
    fetchBinanceKlines("BTCUSDT", "4h", 500, false),
    fetchBinanceKlines("BTCUSDT", "1h", 500, false),
  ]);
  const pack = {
    symbol,
    d1: d1p.candles,
    h4: h4p.candles,
    h1: h1p.candles,
    m15: m15p.candles,
    m5: m5p.candles,
    btcD1: btcD1p.candles,
    btcH4: btcH4p.candles,
    btcH1: btcH1p.candles,
  };
  const start = 80;
  const body = pack.m5.slice(start);
  const split = threeWaySplit(body, 0.5, 0.25);
  const trainEnd = start + split.train.length;
  const valEnd = trainEnd + split.validation.length;

  const train = simulateFromM5({ ...pack, startIndex: start, endIndex: trainEnd, bucket: "train", equityStart: 10000 });
  const validation = simulateFromM5({ ...pack, startIndex: trainEnd, endIndex: valEnd, bucket: "validation", equityStart: train.equity });
  const oos = simulateFromM5({ ...pack, startIndex: valEnd, endIndex: pack.m5.length, bucket: "oos", equityStart: validation.equity });

  const all = [...train.trades, ...validation.trades, ...oos.trades];
  const allStats = stats(all);
  const fees = train.fees + validation.fees + oos.fees;
  const finalEquity = oos.equity;
  const maxDd = Math.max(train.maxDd, validation.maxDd, oos.maxDd);

  const rets = all.map((t) => t.pnl / 10000);
  const n = rets.length || 1;
  const avg = rets.reduce((a, b) => a + b, 0) / n;
  const std = Math.sqrt(rets.reduce((a, b) => a + (b - avg) ** 2, 0) / n) || 1;
  const neg = rets.filter((r) => r < 0);
  const down = Math.sqrt(neg.reduce((a, b) => a + b * b, 0) / (neg.length || 1)) || 1;
  const oosStats = stats(oos.trades);

  const validationFlags = {
    minTrades: allStats.trades >= 100,
    profitFactorOk: (allStats.profitFactor || 0) >= 1.2,
    expectancyOk: allStats.expectancy > 0,
    oosExpectancyOk: oosStats.expectancy > 0,
    feesIncluded: true,
    slippageIncluded: true,
    multiTimeframe: true,
    noFutureData: true,
  };

  return {
    symbol,
    timeframe: "1D+4H+1H+15M+5M",
    trades: allStats.trades,
    totalReturnPct: Number((((finalEquity - 10000) / 10000) * 100).toFixed(2)),
    winRate: allStats.winRate,
    profitFactor: allStats.profitFactor,
    maxDrawdownPct: Number(maxDd.toFixed(2)),
    sharpeRatio: Number(((avg / std) * Math.sqrt(365)).toFixed(2)),
    sortinoRatio: Number(((avg / down) * Math.sqrt(365)).toFixed(2)),
    expectancy: allStats.expectancy,
    averageWin: allStats.averageWin,
    averageLoss: allStats.averageLoss,
    fees: Number(fees.toFixed(2)),
    slippageImpact: SLIPPAGE,
    finalEquity: Number(finalEquity.toFixed(2)),
    inSample: stats(train.trades),
    validation: stats(validation.trades),
    outOfSample: oosStats,
    readyFlags: validationFlags,
    readyForLiveHint: Object.values(validationFlags).every(Boolean),
    note: "Confluence 0–15 is not a win probability. This backtest is research, not a profit guarantee. LIVE is not allowed until flags pass.",
  };
}
