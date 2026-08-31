import { fetchBinanceKlines } from "../binance.js";
import { candleCache } from "./candleCache.js";
import { toSnapshot } from "./TechnicalAnalysis.js";
import { SCAN_SYMBOLS, type MarketSnapshot } from "../trading/types.js";
import { logger } from "../logger.js";

export async function loadTimeframe(symbol: string, interval: string, limit = 250) {
  try {
    const { candles } = await fetchBinanceKlines(symbol, interval, limit, false);
    if (interval === "1m") candleCache.replace(symbol, candles);
    return candles;
  } catch (err) {
    logger.warn({ err, symbol, interval }, "Не удалось загрузить свечи");
    return candleCache.get(symbol);
  }
}

export async function snapshotFor(symbol: string): Promise<{
  h1: MarketSnapshot | null;
  m15: MarketSnapshot | null;
  m5: MarketSnapshot | null;
}> {
  const [h1c, m15c, m5c] = await Promise.all([
    loadTimeframe(symbol, "1h", 250),
    loadTimeframe(symbol, "15m", 200),
    loadTimeframe(symbol, "5m", 200),
  ]);
  return {
    h1: toSnapshot(symbol, h1c, "1H"),
    m15: toSnapshot(symbol, m15c, "15M"),
    m5: toSnapshot(symbol, m5c, "5M"),
  };
}

export async function scanUniverse() {
  const rows = [];
  for (const symbol of SCAN_SYMBOLS) {
    rows.push({ symbol, ...(await snapshotFor(symbol)) });
  }
  return rows;
}
