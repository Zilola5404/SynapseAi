import WebSocket from "ws";
import { type BinanceCandle } from "./binance.js";
import { logger } from "./logger.js";
import { candleCache } from "./market/candleCache.js";
import { computeImbalance, type DepthBook } from "./market/depth.js";
import { marketDataProvider } from "./market/MarketDataProvider.js";

export interface TickerUpdate {
  symbol: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  timestamp: number;
}

const SYMBOLS = ["btcusdt", "ethusdt", "solusdt", "bnbusdt", "xrpusdt", "avaxusdt", "adausdt", "nearusdt"];
const MAX_BACKOFF_MS = 60_000;

class BinanceStreamManager {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private subscribers: Array<(data: Record<string, TickerUpdate>) => void> = [];
  private latestPrices: Record<string, TickerUpdate> = {};
  private latestDepth: Record<string, DepthBook> = {};
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempt = 0;
  private lastNotificationTime = 0;
  private notificationTimer: NodeJS.Timeout | null = null;
  private shouldRun = false;

  public start() {
    this.shouldRun = true;
    this.connect();
    void this.seedCandleHistory();
  }

  public stop() {
    this.shouldRun = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }

  private async seedCandleHistory() {
    await Promise.all(
      SYMBOLS.map(async (sym) => {
        try {
          const candles = await marketDataProvider.fetchKlines({ symbol: sym.toUpperCase(), interval: "1m", limit: 120 });
          candleCache.replace(sym, candles);
          const last = candles[candles.length - 1];
          if (last?.close > 0) {
            this.latestPrices[sym.toUpperCase()] = {
              symbol: sym.toUpperCase(),
              price: last.close,
              change24h: 0,
              high24h: last.high,
              low24h: last.low,
              volume24h: last.volume,
              timestamp: Date.now(),
            };
          }
        } catch (err) {
          logger.warn({ err, sym }, "Failed to load candle history");
        }
      })
    );
    logger.info("Candle cache warmed (120 bars per symbol)");
  }

  private scheduleNotification() {
    const now = Date.now();
    if (now - this.lastNotificationTime >= 1000) {
      this.lastNotificationTime = now;
      this.notifySubscribers();
    } else if (!this.notificationTimer) {
      this.notificationTimer = setTimeout(() => {
        this.notificationTimer = null;
        this.lastNotificationTime = Date.now();
        this.notifySubscribers();
      }, Math.max(100, 1000 - (now - this.lastNotificationTime)));
    }
  }

  private streamUrl() {
    const streams = SYMBOLS.flatMap((s) => [`${s}@ticker`, `${s}@kline_1m`, `${s}@depth10@100ms`]).join("/");
    return `wss://fstream.binance.com/stream?streams=${streams}`;
  }

  private connect() {
    if (!this.shouldRun) return;
    if (this.ws) {
      try {
        this.ws.removeAllListeners();
        this.ws.close();
      } catch {
        // ignore
      }
    }

    try {
      this.ws = new WebSocket(this.streamUrl());

      this.ws.on("open", () => {
        this.isConnected = true;
        this.reconnectAttempt = 0;
        logger.info("Binance Futures WebSocket connected (ticker + kline_1m + depth10)");
      });

      this.ws.on("message", (data: WebSocket.Data) => {
        try {
          const raw = JSON.parse(data.toString());
          const payload = raw.data ?? raw;
          const stream: string = raw.stream || "";

          if (payload.e === "24hrTicker" || payload.s && payload.c && payload.P !== undefined && !payload.k) {
            this.handleTicker(payload);
          } else if (payload.k || stream.includes("kline")) {
            this.handleKline(payload);
          } else if (payload.bids && payload.asks) {
            const symbol = (stream.split("@")[0] || "").toUpperCase();
            this.handleDepth(symbol, payload);
          }
        } catch {
          // ignore parse errors
        }
      });

      this.ws.on("error", (err) => {
        logger.warn({ err: err.message }, "Binance WS error");
        this.isConnected = false;
      });

      this.ws.on("close", () => {
        this.isConnected = false;
        logger.warn("Binance WS disconnected, reconnect with exponential backoff");
        this.scheduleReconnect();
      });
    } catch (err) {
      logger.warn({ err }, "Failed to open Binance WS");
      this.scheduleReconnect();
    }
  }

  private handleTicker(raw: { s: string; c: string; P: string; h: string; l: string; q: string }) {
    const pair = raw.s;
    this.latestPrices[pair] = {
      symbol: pair,
      price: parseFloat(raw.c),
      change24h: parseFloat(raw.P),
      high24h: parseFloat(raw.h),
      low24h: parseFloat(raw.l),
      volume24h: parseFloat(raw.q),
      timestamp: Date.now(),
    };
    this.scheduleNotification();
  }

  private handleKline(raw: { s?: string; k: { t: number; o: string; h: string; l: string; c: string; v: string; T: number } }) {
    const k = raw.k;
    const symbol = raw.s || "";
    const candle: BinanceCandle = {
      openTime: k.t,
      open: parseFloat(k.o),
      high: parseFloat(k.h),
      low: parseFloat(k.l),
      close: parseFloat(k.c),
      volume: parseFloat(k.v),
      closeTime: k.T,
    };
    candleCache.upsert(symbol, candle);
    if (candle.close > 0) {
      const prev = this.latestPrices[symbol];
      this.latestPrices[symbol] = {
        symbol,
        price: candle.close,
        change24h: prev?.change24h ?? 0,
        high24h: Math.max(prev?.high24h ?? 0, candle.high),
        low24h: prev?.low24h ? Math.min(prev.low24h, candle.low) : candle.low,
        volume24h: prev?.volume24h ?? candle.volume,
        timestamp: Date.now(),
      };
    }
  }

  private handleDepth(symbol: string, raw: { bids: [string, string][]; asks: [string, string][] }) {
    if (!symbol) return;
    const bids: [number, number][] = (raw.bids || []).map((b) => [parseFloat(b[0]), parseFloat(b[1])]);
    const asks: [number, number][] = (raw.asks || []).map((a) => [parseFloat(a[0]), parseFloat(a[1])]);
    this.latestDepth[symbol] = {
      symbol,
      bids,
      asks,
      imbalance: computeImbalance(bids, asks),
      timestamp: Date.now(),
    };
  }

  private scheduleReconnect() {
    if (!this.shouldRun) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const delay = Math.min(1000 * 2 ** this.reconnectAttempt, MAX_BACKOFF_MS);
    this.reconnectAttempt += 1;
    logger.info({ delayMs: delay, attempt: this.reconnectAttempt }, "WS reconnect scheduled");
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  public subscribe(callback: (data: Record<string, TickerUpdate>) => void) {
    this.subscribers.push(callback);
    if (Object.keys(this.latestPrices).length > 0) {
      callback(this.latestPrices);
    }
    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== callback);
    };
  }

  private notifySubscribers() {
    this.subscribers.forEach((cb) => {
      try {
        cb(this.latestPrices);
      } catch {
        // ignore subscriber errors
      }
    });
  }

  public getLatestPrices() {
    return this.latestPrices;
  }

  public getPrice(symbol: string): number | null {
    const key = symbol.replace("/", "").toUpperCase();
    return this.latestPrices[key]?.price ?? null;
  }

  public getDepth(symbol: string): DepthBook | null {
    return this.latestDepth[symbol.replace("/", "").toUpperCase()] ?? null;
  }

  public getStatus() {
    return {
      connected: this.isConnected,
      activeSymbols: Object.keys(this.latestPrices).length,
      candleSymbols: SYMBOLS.filter((s) => candleCache.size(s) > 0).length,
      lastUpdated: new Date().toISOString(),
      reconnectAttempt: this.reconnectAttempt,
    };
  }
}

export const binanceWsManager = new BinanceStreamManager();

export function nextBackoffMs(attempt: number, base = 1000, max = MAX_BACKOFF_MS): number {
  return Math.min(base * 2 ** attempt, max);
}
