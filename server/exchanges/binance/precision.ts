import { logger } from "../../logger.js";
import { getFuturesExchangeInfo } from "./futuresClient.js";

export interface SymbolFilters {
  tickSize: number;
  stepSize: number;
  minQty: number;
  maxQty: number;
  minNotional: number;
}

const FALLBACK: Record<string, SymbolFilters> = {
  BTCUSDT: { tickSize: 0.1, stepSize: 0.001, minQty: 0.001, maxQty: 1000, minNotional: 100 },
  ETHUSDT: { tickSize: 0.01, stepSize: 0.001, minQty: 0.001, maxQty: 10000, minNotional: 20 },
  SOLUSDT: { tickSize: 0.001, stepSize: 0.01, minQty: 0.01, maxQty: 100000, minNotional: 5 },
};

const cache = new Map<string, { at: number; filters: Map<string, SymbolFilters> }>();
const TTL = 60 * 60 * 1000;

function parseFilters(info: any): Map<string, SymbolFilters> {
  const out = new Map<string, SymbolFilters>();
  for (const s of info.symbols || []) {
    const lot = (s.filters || []).find((f: any) => f.filterType === "LOT_SIZE") || {};
    const tick = (s.filters || []).find((f: any) => f.filterType === "PRICE_FILTER") || {};
    const minN =
      (s.filters || []).find((f: any) => f.filterType === "MIN_NOTIONAL") ||
      (s.filters || []).find((f: any) => f.filterType === "NOTIONAL") ||
      {};
    out.set(String(s.symbol), {
      tickSize: parseFloat(tick.tickSize || "0.01"),
      stepSize: parseFloat(lot.stepSize || "0.001"),
      minQty: parseFloat(lot.minQty || "0.001"),
      maxQty: parseFloat(lot.maxQty || "1000000"),
      minNotional: parseFloat(minN.notional || minN.minNotional || "5"),
    });
  }
  return out;
}

export async function refreshPrecision(isTestnet: boolean) {
  const key = isTestnet ? "testnet" : "live";
  try {
    const info = await getFuturesExchangeInfo(isTestnet);
    cache.set(key, { at: Date.now(), filters: parseFilters(info) });
    logger.info({ symbols: cache.get(key)?.filters.size, isTestnet }, "exchangeInfo precision cached");
  } catch (err) {
    logger.warn({ err }, "exchangeInfo недоступен, используем fallback precision");
  }
}

function filtersFor(symbol: string, isTestnet: boolean): SymbolFilters {
  const key = isTestnet ? "testnet" : "live";
  const row = cache.get(key);
  const clean = symbol.replace("/", "").toUpperCase();
  return row?.filters.get(clean) || FALLBACK[clean] || FALLBACK.ETHUSDT;
}

export function getSymbolFilters(symbol: string, isTestnet = true): SymbolFilters {
  return filtersFor(symbol, isTestnet);
}

function roundToStep(value: number, step: number): number {
  if (step <= 0) return value;
  const precision = (step.toString().split(".")[1] || "").length;
  const rounded = Math.floor(value / step + 1e-12) * step;
  return Number(rounded.toFixed(precision));
}

export function roundQty(symbol: string, qty: number, isTestnet = true): number {
  const f = filtersFor(symbol, isTestnet);
  const rounded = roundToStep(qty, f.stepSize);
  if (rounded < f.minQty) return 0;
  if (rounded > f.maxQty) return roundToStep(f.maxQty, f.stepSize);
  return rounded;
}

export function roundPrice(symbol: string, price: number, isTestnet = true): number {
  const f = filtersFor(symbol, isTestnet);
  return roundToStep(price, f.tickSize);
}

export function meetsMinNotional(symbol: string, qty: number, price: number, isTestnet = true): boolean {
  const f = filtersFor(symbol, isTestnet);
  return qty >= f.minQty && qty * price >= f.minNotional;
}

export function precisionCacheAge(isTestnet: boolean): number {
  const row = cache.get(isTestnet ? "testnet" : "live");
  return row ? Date.now() - row.at : Number.POSITIVE_INFINITY;
}

export { TTL as PRECISION_TTL };
