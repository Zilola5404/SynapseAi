const STEP: Record<string, number> = {
  BTCUSDT: 0.001,
  ETHUSDT: 0.001,
  SOLUSDT: 0.01,
};

export function roundQty(symbol: string, qty: number): number {
  const step = STEP[symbol.replace("/", "").toUpperCase()] ?? 0.001;
  const rounded = Math.floor(qty / step) * step;
  return Number(rounded.toFixed(8));
}

export function roundPrice(symbol: string, price: number): number {
  const key = symbol.replace("/", "").toUpperCase();
  const decimals = key.startsWith("BTC") ? 1 : key.startsWith("ETH") ? 2 : 3;
  return Number(price.toFixed(decimals));
}
