import { fetchBinanceKlines } from "../../binance.js";
import { toSnapshot } from "../../market/TechnicalAnalysis.js";
import { strategyEngine } from "../strategy/StrategyEngine.js";
import { TAKER_FEE, SLIPPAGE } from "../execution/ExecutionProvider.js";

export async function runHistoricalBacktest(params: {
  symbol: string;
  interval?: string;
  limit?: number;
}) {
  const { candles } = await fetchBinanceKlines(params.symbol, params.interval || "1h", params.limit || 500, false);
  let equity = 10000;
  let peak = 10000;
  let wins = 0;
  let losses = 0;
  let grossWin = 0;
  let grossLoss = 0;
  let fees = 0;
  const trades: { pnl: number }[] = [];

  let maxDd = 0;
  for (let i = 80; i < candles.length - 5; i++) {
    const window = candles.slice(0, i + 1);
    const snap = toSnapshot(params.symbol, window, params.interval || "1h");
    if (!snap) continue;
    const signal = strategyEngine.evaluate(snap, snap, snap);
    if (!signal) continue;
    const entry = candles[i].close * (1 + SLIPPAGE);
    const qtyUsd = equity * 0.005 / (Math.abs(entry - signal.stopLoss) / entry);
    const qty = qtyUsd / entry;
    let exit = candles[i + 1].close;
    let hit = "TIME";
    for (let j = i + 1; j < Math.min(i + 12, candles.length); j++) {
      if (signal.direction === "LONG") {
        if (candles[j].low <= signal.stopLoss) {
          exit = signal.stopLoss;
          hit = "SL";
          break;
        }
        if (candles[j].high >= signal.takeProfit) {
          exit = signal.takeProfit;
          hit = "TP";
          break;
        }
      } else {
        if (candles[j].high >= signal.stopLoss) {
          exit = signal.stopLoss;
          hit = "SL";
          break;
        }
        if (candles[j].low <= signal.takeProfit) {
          exit = signal.takeProfit;
          hit = "TP";
          break;
        }
      }
      exit = candles[j].close;
    }
    const dir = signal.direction === "LONG" ? 1 : -1;
    const fee = entry * qty * TAKER_FEE + exit * qty * TAKER_FEE;
    const pnl = dir * (exit - entry) * qty - fee;
    fees += fee;
    equity += pnl;
    peak = Math.max(peak, equity);
    maxDd = Math.max(maxDd, peak > 0 ? ((peak - equity) / peak) * 100 : 0);
    trades.push({ pnl });
    if (pnl >= 0) {
      wins += 1;
      grossWin += pnl;
    } else {
      losses += 1;
      grossLoss += Math.abs(pnl);
    }
    i += 3;
    void hit;
  }

  const n = trades.length || 1;
  const rets = trades.map((t) => t.pnl / 10000);
  const avg = rets.reduce((a, b) => a + b, 0) / n;
  const varc = rets.reduce((a, b) => a + (b - avg) ** 2, 0) / n;
  const std = Math.sqrt(varc) || 1;
  const neg = rets.filter((r) => r < 0);
  const down = Math.sqrt(neg.reduce((a, b) => a + b * b, 0) / (neg.length || 1)) || 1;

  return {
    symbol: params.symbol,
    trades: trades.length,
    totalReturnPct: Number((((equity - 10000) / 10000) * 100).toFixed(2)),
    winRate: Number(((wins / n) * 100).toFixed(1)),
    profitFactor: grossLoss > 0 ? Number((grossWin / grossLoss).toFixed(2)) : null,
    maxDrawdownPct: Number(maxDd.toFixed(2)),
    sharpeRatio: Number(((avg / std) * Math.sqrt(365)).toFixed(2)),
    sortinoRatio: Number(((avg / down) * Math.sqrt(365)).toFixed(2)),
    expectancy: Number((trades.reduce((a, t) => a + t.pnl, 0) / n).toFixed(2)),
    averageWin: wins ? Number((grossWin / wins).toFixed(2)) : 0,
    averageLoss: losses ? Number((grossLoss / losses).toFixed(2)) : 0,
    fees: Number(fees.toFixed(2)),
    slippageImpact: SLIPPAGE,
    finalEquity: Number(equity.toFixed(2)),
  };
}
