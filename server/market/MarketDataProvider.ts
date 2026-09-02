import { logger } from "../logger.js";
import { bootLog } from "../bootLog.js";
import { config } from "../config.js";
import { sendTelegramMessage } from "../telegram.js";
import { marketDataDownMessage, marketDataUpMessage } from "../telegram/messages.js";
import type { BinanceCandle } from "../binance.js";
import type { TradingMode } from "../trading/types.js";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const DEFAULT_TIMEOUT_MS = Number(process.env.MARKET_DATA_TIMEOUT_MS || 15000);
const RETRIES = 3;

export function futuresMarketDataUrl(mode: TradingMode = "PAPER"): string {
  const custom = (process.env.MARKET_DATA_API_ROOT || "").trim().replace(/\/$/, "");
  if (custom) return custom;
  if (mode === "TESTNET" && process.env.MARKET_DATA_USE_TESTNET === "true") {
    return "https://testnet.binancefuture.com";
  }
  return "https://fapi.binance.com";
}

export function futuresKlinesPath(symbol: string, interval: string, limit: number) {
  const clean = symbol.replace("/", "").toUpperCase();
  return `/fapi/v1/klines?symbol=${clean}&interval=${interval}&limit=${limit}`;
}

export type MarketDataState = "DATA_FRESH" | "DATA_STALE" | "DATA_UNAVAILABLE";

export const MARKET_DATA_STALE_MS = Number(process.env.MARKET_DATA_STALE_MS || 120_000);

export class MarketDataCircuit {
  consecutiveFailures = 0;
  degraded = false;
  lastSuccessAt = 0;
  private alertedDegraded = false;

  dataState(): MarketDataState {
    if (this.degraded) return "DATA_UNAVAILABLE";
    if (this.lastSuccessAt > 0 && Date.now() - this.lastSuccessAt > MARKET_DATA_STALE_MS) return "DATA_STALE";
    return "DATA_FRESH";
  }

  canOpenNewTrades() {
    return this.dataState() === "DATA_FRESH";
  }

  touchSuccess() {
    this.lastSuccessAt = Date.now();
  }

  recordSuccess() {
    const was = this.degraded;
    this.consecutiveFailures = 0;
    this.degraded = false;
    this.alertedDegraded = false;
    this.lastSuccessAt = Date.now();
    if (was) {
      bootLog("[MARKET] API HEALTHY — scanning can resume");
      logger.info("Market data API HEALTHY");
      void this.alert(marketDataUpMessage("ru"));
    }
  }

  recordFailure() {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= 3 && !this.degraded) {
      this.degraded = true;
      bootLog("[MARKET] MARKET DATA DEGRADED — stop opening new trades");
      logger.warn({ failures: this.consecutiveFailures }, "MARKET DATA DEGRADED");
      if (!this.alertedDegraded) {
        this.alertedDegraded = true;
        void this.alert(marketDataDownMessage("ru"));
      }
    }
  }

  private async alert(message: string) {
    const token = config.telegramBotToken;
    const chat = config.telegramOwnerChatId;
    if (!token || !chat) return;
    await sendTelegramMessage({ botToken: token, chatId: chat, message, parseMode: "HTML" }).catch(() => undefined);
  }
}

export class MarketDataProvider {
  readonly circuit = new MarketDataCircuit();

  constructor(
    private fetchFn: FetchLike = fetch,
    private mode: TradingMode = "PAPER"
  ) {}

  setMode(mode: TradingMode) {
    this.mode = mode;
  }

  isHealthy() {
    return !this.circuit.degraded;
  }

  dataState() {
    return this.circuit.dataState();
  }

  lastMarketUpdate() {
    return this.circuit.lastSuccessAt;
  }

  canOpenNewTrades() {
    return this.circuit.canOpenNewTrades();
  }

  touchSuccess() {
    this.circuit.touchSuccess();
  }

  async fetchKlines(params: {
    symbol: string;
    interval: string;
    limit?: number;
  }): Promise<BinanceCandle[]> {
    const symbol = params.symbol.replace("/", "").toUpperCase();
    const interval = params.interval;
    const limit = params.limit ?? 200;
    const url = `${futuresMarketDataUrl(this.mode)}${futuresKlinesPath(symbol, interval, limit)}`;
    let lastErr = "unknown";

    for (let attempt = 1; attempt <= RETRIES; attempt++) {
      try {
        const res = await this.fetchFn(url, {
          headers: { "User-Agent": "SynapseCryptoAI/1.0" },
          signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = (await res.json()) as unknown[];
        if (!Array.isArray(raw) || raw.length === 0) throw new Error("empty klines");
        const candles = raw.map((k: any) => ({
          openTime: k[0],
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
          volume: parseFloat(k[5]),
          closeTime: k[6],
        }));
        this.circuit.recordSuccess();
        return candles;
      } catch (err) {
        lastErr = err instanceof Error ? err.message : String(err);
        logger.warn({ symbol, interval, attempt, err: lastErr }, "Failed to load candles");
        if (attempt < RETRIES) {
          await new Promise((r) => setTimeout(r, 400 * attempt));
        }
      }
    }

    this.circuit.recordFailure();
    logger.warn({ symbol, interval, lastErr }, "MARKET DATA UNAVAILABLE — skip symbol");
    throw new Error(`MARKET_DATA_UNAVAILABLE ${symbol} ${interval}: ${lastErr}`);
  }
}

export const marketDataProvider = new MarketDataProvider();
