import type { BinanceCandle } from "../binance.js";
import { calculateIndicators, type TechnicalIndicators } from "../binance.js";

const MAX_CANDLES = 500;

export class CandleCache {
  private readonly candles = new Map<string, BinanceCandle[]>();

  replace(symbol: string, list: BinanceCandle[]) {
    const key = normalizeSymbol(symbol);
    this.candles.set(key, list.slice(-MAX_CANDLES));
  }

  upsert(symbol: string, candle: BinanceCandle) {
    const key = normalizeSymbol(symbol);
    const list = this.candles.get(key) ?? [];
    const last = list[list.length - 1];
    if (last && last.openTime === candle.openTime) {
      list[list.length - 1] = candle;
    } else {
      list.push(candle);
      if (list.length > MAX_CANDLES) list.shift();
    }
    this.candles.set(key, list);
  }

  get(symbol: string): BinanceCandle[] {
    return [...(this.candles.get(normalizeSymbol(symbol)) ?? [])];
  }

  size(symbol: string): number {
    return this.candles.get(normalizeSymbol(symbol))?.length ?? 0;
  }

  indicators(symbol: string): TechnicalIndicators | null {
    const list = this.get(symbol);
    if (list.length < 14) return null;
    return calculateIndicators(list);
  }
}

export function normalizeSymbol(symbol: string): string {
  return symbol.replace("/", "").replace("-", "").toUpperCase();
}

export const candleCache = new CandleCache();
