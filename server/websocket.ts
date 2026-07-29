import WebSocket from 'ws';

export interface TickerUpdate {
  symbol: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  timestamp: number;
}

class BinanceStreamManager {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private subscribers: Array<(data: Record<string, TickerUpdate>) => void> = [];
  private latestPrices: Record<string, TickerUpdate> = {};
  private reconnectTimer: NodeJS.Timeout | null = null;

  private symbols = [
    'btcusdt',
    'ethusdt',
    'solusdt',
    'bnbusdt',
    'xrpusdt',
    'avaxusdt',
    'adausdt',
    'nearusdt',
  ];

  private lastNotificationTime = 0;
  private notificationTimer: NodeJS.Timeout | null = null;

  public start() {
    this.connect();
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

  private connect() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
    }

    const streams = this.symbols.map((s) => `${s}@ticker`).join('/');
    const streamUrl = `wss://stream.binance.com:9443/ws/${streams}`;

    try {
      this.ws = new WebSocket(streamUrl);

      this.ws.on('open', () => {
        this.isConnected = true;
        console.log('⚡ Binance WebSocket Stream Connected successfully');
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const raw = JSON.parse(data.toString());
          if (raw && raw.s && raw.c) {
            const pair = raw.s; // e.g. BTCUSDT
            const price = parseFloat(raw.c); // current price
            const change24h = parseFloat(raw.P); // price change percent
            const high24h = parseFloat(raw.h);
            const low24h = parseFloat(raw.l);
            const volume24h = parseFloat(raw.q); // quote volume

            this.latestPrices[pair] = {
              symbol: pair,
              price,
              change24h,
              high24h,
              low24h,
              volume24h,
              timestamp: Date.now(),
            };

            this.scheduleNotification();
          }
        } catch (err) {
          // ignore parse errors
        }
      });

      this.ws.on('error', (err) => {
        console.warn('Binance WS error:', err.message);
        this.isConnected = false;
      });

      this.ws.on('close', () => {
        this.isConnected = false;
        console.log('Binance WS disconnected, scheduling reconnect...');
        this.scheduleReconnect();
      });
    } catch (err) {
      console.warn('Failed to connect Binance WS:', err);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 5000);
  }

  public subscribe(callback: (data: Record<string, TickerUpdate>) => void) {
    this.subscribers.push(callback);
    // Send cached immediately
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
      } catch {}
    });
  }

  public getLatestPrices() {
    return this.latestPrices;
  }

  public getStatus() {
    return {
      connected: this.isConnected,
      activeSymbols: Object.keys(this.latestPrices).length,
      lastUpdated: new Date().toISOString(),
    };
  }
}

export const binanceWsManager = new BinanceStreamManager();
