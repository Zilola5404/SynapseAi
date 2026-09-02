import type { BinanceCandle } from "../binance.js";

const FAPI = "https://fapi.binance.com";

function parseKline(k: unknown[]): BinanceCandle {
  return {
    openTime: Number(k[0]),
    open: parseFloat(String(k[1])),
    high: parseFloat(String(k[2])),
    low: parseFloat(String(k[3])),
    close: parseFloat(String(k[4])),
    volume: parseFloat(String(k[5])),
    closeTime: Number(k[6]),
  };
}

/** Historical USD-M klines, oldest first. No future pages. Direct fapi, not the live circuit. */
export async function fetchKlinesPaged(symbol: string, interval: string, want: number): Promise<BinanceCandle[]> {
  const clean = symbol.replace("/", "").toUpperCase();
  const out: BinanceCandle[] = [];
  let endTime = Date.now();
  while (out.length < want) {
    const url = `${FAPI}/fapi/v1/klines?symbol=${clean}&interval=${interval}&limit=1500&endTime=${endTime}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "SynapseCryptoAI/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`klines ${clean} ${interval} HTTP ${res.status}`);
    const raw = (await res.json()) as unknown[];
    if (!Array.isArray(raw) || raw.length === 0) break;
    const batch = raw.map((row) => parseKline(row as unknown[]));
    out.unshift(...batch);
    const first = batch[0];
    if (!first || batch.length < 2) break;
    endTime = first.openTime - 1;
    if (batch.length < 1500) break;
    await new Promise((r) => setTimeout(r, 80));
  }
  const seen = new Set<number>();
  const uniq = out.filter((c) => {
    if (seen.has(c.openTime)) return false;
    seen.add(c.openTime);
    return true;
  });
  uniq.sort((a, b) => a.openTime - b.openTime);
  return uniq.slice(-want);
}
