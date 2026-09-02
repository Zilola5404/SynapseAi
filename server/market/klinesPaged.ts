import fs from "node:fs";
import path from "node:path";
import type { BinanceCandle } from "../binance.js";

const FAPI = "https://fapi.binance.com";
const CACHE_DIR = path.resolve("data/klines");

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

function dedupeSort(rows: BinanceCandle[]) {
  const seen = new Set<number>();
  const uniq = rows.filter((c) => {
    if (seen.has(c.openTime)) return false;
    seen.add(c.openTime);
    return true;
  });
  uniq.sort((a, b) => a.openTime - b.openTime);
  return uniq;
}

async function fetchJson(url: string, attempt = 0): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": "SynapseCryptoAI/1.0" },
    signal: AbortSignal.timeout(20000),
  });
  if (res.status === 429 || res.status === 418) {
    if (attempt >= 6) throw new Error(`klines HTTP ${res.status}`);
    const wait = Number(res.headers.get("retry-after") || 0) * 1000 || 400 * 2 ** attempt;
    await new Promise((r) => setTimeout(r, wait));
    return fetchJson(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

export async function fetchKlinesRange(
  symbol: string,
  interval: string,
  startTime: number,
  endTime = Date.now()
): Promise<BinanceCandle[]> {
  const clean = symbol.replace("/", "").toUpperCase();
  const out: BinanceCandle[] = [];
  let cursor = startTime;
  while (cursor < endTime) {
    const url = `${FAPI}/fapi/v1/klines?symbol=${clean}&interval=${interval}&limit=1500&startTime=${cursor}&endTime=${endTime}`;
    const raw = (await fetchJson(url)) as unknown[];
    if (!Array.isArray(raw) || raw.length === 0) break;
    const batch = raw.map((row) => parseKline(row as unknown[]));
    out.push(...batch);
    const last = batch[batch.length - 1];
    if (!last) break;
    const next = last.openTime + 1;
    if (next <= cursor) break;
    cursor = next;
    if (batch.length < 1500) break;
    await new Promise((r) => setTimeout(r, 80));
  }
  return dedupeSort(out);
}

/** Historical USD-M klines, oldest first. No future pages. Direct fapi, not the live circuit. */
export async function fetchKlinesPaged(symbol: string, interval: string, want: number): Promise<BinanceCandle[]> {
  const clean = symbol.replace("/", "").toUpperCase();
  const out: BinanceCandle[] = [];
  let endTime = Date.now();
  while (out.length < want) {
    const url = `${FAPI}/fapi/v1/klines?symbol=${clean}&interval=${interval}&limit=1500&endTime=${endTime}`;
    const raw = (await fetchJson(url)) as unknown[];
    if (!Array.isArray(raw) || raw.length === 0) break;
    const batch = raw.map((row) => parseKline(row as unknown[]));
    out.unshift(...batch);
    const first = batch[0];
    if (!first || batch.length < 2) break;
    endTime = first.openTime - 1;
    if (batch.length < 1500) break;
    await new Promise((r) => setTimeout(r, 80));
  }
  return dedupeSort(out).slice(-want);
}

function cachePath(symbol: string, interval: string) {
  return path.join(CACHE_DIR, `${symbol.replace("/", "").toUpperCase()}_${interval}.json`);
}

type CacheFile = { startTime: number; endTime: number; candles: BinanceCandle[] };

export async function loadKlinesCached(
  symbol: string,
  interval: string,
  startTime: number,
  endTime = Date.now()
): Promise<BinanceCandle[]> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const file = cachePath(symbol, interval);
  let cached: CacheFile | null = null;
  if (fs.existsSync(file)) {
    try {
      cached = JSON.parse(fs.readFileSync(file, "utf8")) as CacheFile;
    } catch {
      cached = null;
    }
  }
  if (cached && cached.startTime <= startTime && cached.endTime >= endTime - 5 * 60_000) {
    return cached.candles.filter((c) => c.openTime >= startTime && c.closeTime <= endTime);
  }
  const fetchStart = cached ? Math.min(cached.startTime, startTime) : startTime;
  const rows = await fetchKlinesRange(symbol, interval, fetchStart, endTime);
  const merged = dedupeSort([...(cached?.candles || []), ...rows]);
  const payload: CacheFile = {
    startTime: merged[0]?.openTime || startTime,
    endTime: merged[merged.length - 1]?.closeTime || endTime,
    candles: merged,
  };
  fs.writeFileSync(file, JSON.stringify(payload));
  return merged.filter((c) => c.openTime >= startTime && c.closeTime <= endTime);
}

export type FundingPoint = { time: number; rate: number };

export async function loadFundingCached(symbol: string, startTime: number, endTime = Date.now()): Promise<FundingPoint[]> {
  const clean = symbol.replace("/", "").toUpperCase();
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, `${clean}_funding.json`);
  if (fs.existsSync(file)) {
    try {
      const cached = JSON.parse(fs.readFileSync(file, "utf8")) as { startTime: number; endTime: number; rows: FundingPoint[] };
      if (cached.startTime <= startTime && cached.endTime >= endTime - 8 * 3600_000) {
        return cached.rows.filter((r) => r.time >= startTime && r.time <= endTime);
      }
    } catch {
      /* refetch */
    }
  }
  const rows: FundingPoint[] = [];
  let cursor = startTime;
  try {
    while (cursor < endTime) {
      const url = `${FAPI}/fapi/v1/fundingRate?symbol=${clean}&startTime=${cursor}&endTime=${endTime}&limit=1000`;
      const raw = (await fetchJson(url)) as { fundingTime: number; fundingRate: string }[];
      if (!Array.isArray(raw) || raw.length === 0) break;
      for (const r of raw) {
        rows.push({ time: Number(r.fundingTime), rate: parseFloat(String(r.fundingRate)) });
      }
      const last = raw[raw.length - 1];
      const next = Number(last.fundingTime) + 1;
      if (next <= cursor) break;
      cursor = next;
      if (raw.length < 1000) break;
      await new Promise((r) => setTimeout(r, 80));
    }
  } catch {
    return [];
  }
  const uniq = new Map<number, FundingPoint>();
  for (const r of rows) uniq.set(r.time, r);
  const sorted = [...uniq.values()].sort((a, b) => a.time - b.time);
  if (sorted.length) {
    fs.writeFileSync(
      file,
      JSON.stringify({
        startTime: sorted[0].time,
        endTime: sorted[sorted.length - 1].time,
        rows: sorted,
      })
    );
  }
  return sorted.filter((r) => r.time >= startTime && r.time <= endTime);
}
