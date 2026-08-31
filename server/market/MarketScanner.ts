import { candleCache } from "./candleCache.js";
import { toSnapshot } from "./TechnicalAnalysis.js";
import { SCAN_SYMBOLS, type MarketSnapshot } from "../trading/types.js";
import { logger } from "../logger.js";
import { marketDataProvider } from "./MarketDataProvider.js";

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

export async function snapshotFor(symbol: string): Promise<{
  h1: MarketSnapshot | null;
  m15: MarketSnapshot | null;
  m5: MarketSnapshot | null;
  marketDataOk: boolean;
}> {
  const [h1c, m15c, m5c] = await Promise.all([
    loadTimeframe(symbol, "1h", 250),
    loadTimeframe(symbol, "15m", 200),
    loadTimeframe(symbol, "5m", 200),
  ]);
  const h1 = toSnapshot(symbol, h1c, "1H");
  const m15 = toSnapshot(symbol, m15c, "15M");
  const m5 = toSnapshot(symbol, m5c, "5M");
  return {
    h1,
    m15,
    m5,
    marketDataOk: Boolean(h1 && m15 && m5),
  };
}

export async function scanUniverse() {
  const rows = [];
  for (const symbol of SCAN_SYMBOLS) {
    rows.push({ symbol, ...(await snapshotFor(symbol)) });
  }
  return rows;
}
