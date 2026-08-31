import {
  getSymbolFilters,
  refreshPrecision,
  roundPrice,
  roundQty,
  meetsMinNotional,
  type SymbolFilters,
} from "./binance/precision.js";

/** exchangeInfo snapshot used before every TESTNET/LIVE order. */
export class ExchangeMetadataService {
  async refresh(isTestnet = true) {
    await refreshPrecision(isTestnet);
  }

  filters(symbol: string, isTestnet = true): SymbolFilters {
    return getSymbolFilters(symbol, isTestnet);
  }

  normalizePrice(symbol: string, price: number, isTestnet = true) {
    return roundPrice(symbol, price, isTestnet);
  }

  normalizeQty(symbol: string, qty: number, isTestnet = true) {
    return roundQty(symbol, qty, isTestnet);
  }

  validateNotional(symbol: string, qty: number, price: number, isTestnet = true) {
    return meetsMinNotional(symbol, qty, price, isTestnet);
  }
}

export const exchangeMetadata = new ExchangeMetadataService();
