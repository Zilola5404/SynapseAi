import { candleCache } from "./candleCache.js";
import { toSnapshot } from "./TechnicalAnalysis.js";
import { SCAN_SYMBOLS, type MarketSnapshot } from "../trading/types.js";
import { logger } from "../logger.js";
import { marketDataProvider } from "./MarketDataProvider.js";
import type { BinanceCandle } from "../binance.js";

export type SymbolBundle = {
  symbol: string;
  d1: MarketSnapshot | null;
  h4: MarketSnapshot | null;
  h1: MarketSnapshot | null;
  m15: MarketSnapshot | null;
  m5: MarketSnapshot | null;
  candles: {
    d1: BinanceCandle[];
    h4: BinanceCandle[];
    h1: BinanceCandle[];
    m15: BinanceCandle[];
    m5: BinanceCandle[];
  };
  marketDataOk: boolean;
};

export async function loadTimeframe(symbol: string, interval: string, limit = 250) {
  try {
    const candles = await marketDataProvider.fetchKlines({ symbol, interval, limit });
    if (interval === "1m") candleCache.replace(symbol, candles);
    return candles;
  } catch (err) {
    logger.warn({ err, symbol, interval }, "MARKET DATA UNAVAILABLE — skip symbol");
    if (interval === "1m") return candleCache.get(symbol);
    return [];
  }
}

export async function snapshotFor(symbol: string): Promise<SymbolBundle> {
  const [d1c, h4c, h1c, m15c, m5c] = await Promise.all([
    loadTimeframe(symbol, "1d", 180),
    loadTimeframe(symbol, "4h", 180),
    loadTimeframe(symbol, "1h", 250),
    loadTimeframe(symbol, "15m", 200),
    loadTimeframe(symbol, "5m", 200),
  ]);
  const d1 = toSnapshot(symbol, d1c, "1D");
  const h4 = toSnapshot(symbol, h4c, "4H");
  const h1 = toSnapshot(symbol, h1c, "1H");
  const m15 = toSnapshot(symbol, m15c, "15M");
  const m5 = toSnapshot(symbol, m5c, "5M");
  return {
    symbol,
    d1,
    h4,
    h1,
    m15,
    m5,
    candles: { d1: d1c, h4: h4c, h1: h1c, m15: m15c, m5: m5c },
    marketDataOk: Boolean(h1 && m15 && m5),
  };
}

export async function scanUniverse() {
  const btc = await snapshotFor("BTCUSDT");
  const rows: Array<SymbolBundle & { btc: SymbolBundle }> = [];
  for (const symbol of SCAN_SYMBOLS) {
    const snap = symbol === "BTCUSDT" ? btc : await snapshotFor(symbol);
    rows.push({ ...snap, btc });
  }
  return rows;
}
