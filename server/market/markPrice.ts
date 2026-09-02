import { binanceWsManager } from "../websocket.js";
import { futuresMarketDataUrl } from "./MarketDataProvider.js";

/** Mark / last price: WebSocket first, public Futures REST fallback. Does not trip the market-data circuit. */
export async function fetchLastPrice(symbol: string): Promise<number | null> {
  const ws = binanceWsManager.getPrice(symbol);
  if (ws && ws > 0) return ws;
  const clean = symbol.replace("/", "").toUpperCase();
  try {
    const url = `${futuresMarketDataUrl()}/fapi/v1/ticker/price?symbol=${clean}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "SynapseCryptoAI/1.0" },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { price?: string };
    const price = parseFloat(body.price || "0");
    return Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}
