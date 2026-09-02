import { getBinanceBaseUrl } from "../../binance.js";
import { logger } from "../../logger.js";

/** Binance allows up to 60s. Wider window survives local clock drift. */
export const BINANCE_RECV_WINDOW = 60_000;

let offsetMs = 0;
let lastSyncAt = 0;

export function binanceTimestamp() {
  return Date.now() + offsetMs;
}

export function binanceTimeOffset() {
  return offsetMs;
}

export async function syncBinanceServerTime(isTestnet = true, isFutures = true, baseOverride?: string) {
  const base = (baseOverride || getBinanceBaseUrl(isTestnet, isFutures)).replace(/\/$/, "");
  const path = isFutures ? "/fapi/v1/time" : "/api/v3/time";
  const t0 = Date.now();
  const res = await fetch(`${base}${path}`, {
    signal: AbortSignal.timeout(8000),
    headers: { "User-Agent": "SynapseCryptoAI/1.0" },
  });
  const t1 = Date.now();
  if (!res.ok) throw new Error(`Binance time HTTP ${res.status}`);
  const body = (await res.json()) as { serverTime?: number };
  const serverTime = Number(body.serverTime);
  if (!Number.isFinite(serverTime)) throw new Error("Binance time: no serverTime");
  const localMid = Math.floor((t0 + t1) / 2);
  offsetMs = serverTime - localMid;
  lastSyncAt = Date.now();
  logger.info({ offsetMs, isTestnet, isFutures }, "Binance server time synced");
  return offsetMs;
}

export async function ensureBinanceTime(isTestnet = true, isFutures = true) {
  if (Date.now() - lastSyncAt > 30_000) {
    await syncBinanceServerTime(isTestnet, isFutures);
  }
}
