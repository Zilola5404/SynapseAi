import crypto from 'crypto';

export interface BinanceCandle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}

export interface TechnicalIndicators {
  rsi: number;
  macdSignal: 'BULLISH_CROSS' | 'BEARISH_CROSS' | 'NEUTRAL';
  ema20: number;
  ema50: number;
  atr: number;
  volatility: number;
}

/** Current USD-M Futures Demo REST. Keys from demo.binance.com. */
export const BINANCE_FUTURES_TESTNET_URL_DEFAULT = "https://demo-fapi.binance.com";
/** Legacy Futures Testnet REST (keys from testnet.binancefuture.com). */
export const BINANCE_FUTURES_TESTNET_URL_LEGACY = "https://testnet.binancefuture.com";

export function getBinanceBaseUrl(isTestnet: boolean = true, isFutures: boolean = false): string {
  if (isFutures) {
    if (!isTestnet) return "https://fapi.binance.com";
    const custom = (process.env.BINANCE_FUTURES_TESTNET_URL || "").trim().replace(/\/$/, "");
    return custom || BINANCE_FUTURES_TESTNET_URL_DEFAULT;
  }
  return isTestnet ? "https://testnet.binance.vision" : "https://api.binance.com";
}

export function createBinanceSignature(queryString: string, apiSecret: string): string {
  return crypto
    .createHmac('sha256', apiSecret)
    .update(queryString)
    .digest('hex');
}

/**
 * Calculates technical indicators from raw OHLCV candles
 */
export function calculateIndicators(candles: BinanceCandle[]): TechnicalIndicators {
  if (!candles || candles.length < 14) {
    return {
      rsi: 50,
      macdSignal: 'NEUTRAL',
      ema20: candles[candles.length - 1]?.close || 0,
      ema50: candles[candles.length - 1]?.close || 0,
      atr: 0,
      volatility: 2.0,
    };
  }

  const closes = candles.map((c) => c.close);
  const len = closes.length;

  // 1. RSI-14
  let gains = 0;
  let losses = 0;
  for (let i = len - 14; i < len; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / 14;
  const avgLoss = losses / 14;
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = Number((100 - 100 / (1 + rs)).toFixed(1));

  // 2. EMA Helper
  const calcEMA = (period: number): number => {
    const k = 2 / (period + 1);
    let ema = closes[0];
    for (let i = 1; i < len; i++) {
      ema = closes[i] * k + ema * (1 - k);
    }
    return ema;
  };

  const ema20 = Number(calcEMA(20).toFixed(2));
  const ema50 = Number(calcEMA(50).toFixed(2));
  const ema12 = calcEMA(12);
  const ema26 = calcEMA(26);
  const macdLine = ema12 - ema26;

  let macdSignal: 'BULLISH_CROSS' | 'BEARISH_CROSS' | 'NEUTRAL' = 'NEUTRAL';
  if (macdLine > 0 && ema20 > ema50) {
    macdSignal = 'BULLISH_CROSS';
  } else if (macdLine < 0 && ema20 < ema50) {
    macdSignal = 'BEARISH_CROSS';
  }

  // 3. Volatility (Percentage spread over last 14 periods)
  const highLowDiffs = candles.slice(-14).map((c) => ((c.high - c.low) / c.close) * 100);
  const volatility = Number((highLowDiffs.reduce((a, b) => a + b, 0) / 14).toFixed(2));

  // 4. ATR-14
  let trSum = 0;
  for (let i = len - 14; i < len; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );
    trSum += tr;
  }
  const atr = Number((trSum / 14).toFixed(2));

  return { rsi, macdSignal, ema20, ema50, atr, volatility };
}

/**
 * Fetch real candles (klines) from Binance
 */
export async function fetchBinanceKlines(
  symbol: string = 'BTCUSDT',
  interval: string = '5m',
  limit: number = 100,
  _isTestnet: boolean = false
): Promise<{ candles: BinanceCandle[]; indicators: TechnicalIndicators }> {
  const { marketDataProvider } = await import("./market/MarketDataProvider.js");
  const candles = await marketDataProvider.fetchKlines({ symbol, interval, limit });
  const indicators = calculateIndicators(candles);
  return { candles, indicators };
}

/**
 * Fetch Order Book & Imbalance
 */
export async function fetchBinanceOrderBook(
  symbol: string = 'BTCUSDT',
  limit: number = 20,
  isTestnet: boolean = false
): Promise<{ bids: [number, number][]; asks: [number, number][]; imbalance: number }> {
  const baseUrl = getBinanceBaseUrl(isTestnet, false);
  const cleanSymbol = symbol.replace('/', '').toUpperCase();
  const url = `${baseUrl}/api/v3/depth?symbol=${cleanSymbol}&limit=${limit}`;

  const res = await fetch(url, { headers: { 'User-Agent': 'SynapseCryptoAI/1.0' } });
  if (!res.ok) {
    throw new Error(`Orderbook HTTP error: ${res.status}`);
  }

  const data = await res.json();
  const bids: [number, number][] = data.bids.map((b: any) => [parseFloat(b[0]), parseFloat(b[1])]);
  const asks: [number, number][] = data.asks.map((a: any) => [parseFloat(a[0]), parseFloat(a[1])]);

  const bidVol = bids.reduce((acc, b) => acc + b[0] * b[1], 0);
  const askVol = asks.reduce((acc, a) => acc + a[0] * a[1], 0);
  const totalVol = bidVol + askVol;

  const imbalance = totalVol > 0 ? Math.round(((bidVol - askVol) / totalVol) * 100) : 0;

  return { bids, asks, imbalance };
}

/**
 * Fetch Account Balances with HMAC SHA256 Signature
 */
export async function fetchBinanceAccountBalance(
  apiKey: string,
  apiSecret: string,
  isTestnet: boolean = true
): Promise<{ totalEquityUsdt: number; availableBalanceUsdt: number; balances: any[] }> {
  const { getFuturesAccount } = await import("./exchanges/binance/futuresClient.js");
  const acc = await getFuturesAccount(apiKey, apiSecret, isTestnet);
  return {
    totalEquityUsdt: acc.totalEquityUsdt,
    availableBalanceUsdt: acc.availableBalanceUsdt,
    balances: [],
  };
}

/**
 * Interface for Binance Order Creation
 */
export interface BinanceOrderParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'LIMIT' | 'MARKET';
  quantity: number;
  price?: number; // required for LIMIT
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  isFutures?: boolean;
  isTestnet?: boolean;
  apiKey?: string;
  apiSecret?: string;
  markPrice?: number;
}

export interface BinanceOrderResult {
  orderId: number | string;
  symbol: string;
  status: 'NEW' | 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELED' | 'EXPIRED' | 'REJECTED';
  side: 'BUY' | 'SELL';
  type: 'LIMIT' | 'MARKET';
  price: number;
  origQty: number;
  executedQty: number;
  cummulativeQuoteQty: number;
  transactTime: number;
  isPaperTrade?: boolean;
}

/**
 * Place Order on Binance (Spot or Futures) or fallback to paper engine if keys missing/testnet failure
 */
export async function placeBinanceOrder(
  params: BinanceOrderParams
): Promise<BinanceOrderResult> {
  const {
    symbol,
    side,
    type,
    quantity,
    price,
    timeInForce = 'GTC',
    isFutures = false,
    isTestnet = true,
    apiKey,
    apiSecret,
    markPrice,
  } = params;

  const cleanSymbol = symbol.replace('/', '').toUpperCase();

  // If valid keys are provided, try calling real Binance API
  if (apiKey && apiSecret && apiKey.trim().length > 10 && apiSecret.trim().length > 10) {
    const baseUrl = getBinanceBaseUrl(isTestnet, isFutures);
    const endpoint = isFutures ? '/fapi/v1/order' : '/api/v3/order';
    const timestamp = Date.now();

    const queryParams: string[] = [
      `symbol=${cleanSymbol}`,
      `side=${side}`,
      `type=${type}`,
      `quantity=${quantity}`,
      `timestamp=${timestamp}`,
      `recvWindow=5000`,
    ];

    if (type === 'LIMIT') {
      if (!price || price <= 0) {
        throw new Error('Для лимитного ордера необходимо указать цену (price)');
      }
      queryParams.push(`price=${price}`);
      queryParams.push(`timeInForce=${timeInForce}`);
    }

    const queryString = queryParams.join('&');
    const signature = createBinanceSignature(queryString, apiSecret);
    const url = `${baseUrl}${endpoint}?${queryString}&signature=${signature}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-MBX-APIKEY': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'SynapseCryptoAI/1.0',
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      const { classifyBinanceError, formatBinanceError } = await import("./binanceErrors.js");
      const classified = classifyBinanceError(res.status, errText);
      throw new Error(formatBinanceError(classified.kind, classified.message));
    }

    const data = await res.json();
    return {
      orderId: data.orderId || `BN_${Date.now()}`,
      symbol: cleanSymbol,
      status: data.status || 'FILLED',
      side: data.side || side,
      type: data.type || type,
      price: parseFloat(data.price || price || '0'),
      origQty: parseFloat(data.origQty || quantity.toString()),
      executedQty: parseFloat(data.executedQty || quantity.toString()),
      cummulativeQuoteQty: parseFloat(data.cummulativeQuoteQty || '0'),
      transactTime: data.transactTime || Date.now(),
      isPaperTrade: false,
    };
  }

  // Paper / Simulation Mode Response
  const simulatedPrice = price && price > 0 ? price : markPrice && markPrice > 0 ? markPrice : 0;
  if (!simulatedPrice) {
    throw new Error("Нет рыночной цены для paper-ордера");
  }
  return {
    orderId: `PAPER_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    symbol: cleanSymbol,
    status: 'FILLED',
    side,
    type,
    price: simulatedPrice,
    origQty: quantity,
    executedQty: quantity,
    cummulativeQuoteQty: Number((simulatedPrice * quantity).toFixed(2)),
    transactTime: Date.now(),
    isPaperTrade: true,
  };
}

/**
 * Cancel Order on Binance
 */
export async function cancelBinanceOrder(
  symbol: string,
  orderId: string | number,
  apiKey?: string,
  apiSecret?: string,
  isTestnet: boolean = true,
  isFutures: boolean = false
): Promise<{ success: boolean; orderId: string | number; message: string }> {
  const cleanSymbol = symbol.replace('/', '').toUpperCase();

  if (apiKey && apiSecret && apiKey.trim().length > 10 && apiSecret.trim().length > 10) {
    const baseUrl = getBinanceBaseUrl(isTestnet, isFutures);
    const endpoint = isFutures ? '/fapi/v1/order' : '/api/v3/order';
    const timestamp = Date.now();
    const queryString = `symbol=${cleanSymbol}&orderId=${orderId}&recvWindow=5000&timestamp=${timestamp}`;
    const signature = createBinanceSignature(queryString, apiSecret);

    const res = await fetch(`${baseUrl}${endpoint}?${queryString}&signature=${signature}`, {
      method: 'DELETE',
      headers: {
        'X-MBX-APIKEY': apiKey,
        'User-Agent': 'SynapseCryptoAI/1.0',
      },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Не удалось отменить ордер на Binance: ${err}`);
    }

    const data = await res.json();
    return {
      success: true,
      orderId: data.orderId,
      message: `Ордер #${orderId} отменен на бирже Binance`,
    };
  }

  return {
    success: true,
    orderId,
    message: `Бумажный ордер #${orderId} успешно отменен`,
  };
}

/**
 * Fetch Open Orders
 */
export async function fetchBinanceOpenOrders(
  symbol?: string,
  apiKey?: string,
  apiSecret?: string,
  isTestnet: boolean = true,
  isFutures: boolean = false
): Promise<any[]> {
  if (apiKey && apiSecret && apiKey.trim().length > 10 && apiSecret.trim().length > 10) {
    const baseUrl = getBinanceBaseUrl(isTestnet, isFutures);
    const endpoint = isFutures ? '/fapi/v1/openOrders' : '/api/v3/openOrders';
    const timestamp = Date.now();
    let queryString = `recvWindow=5000&timestamp=${timestamp}`;

    if (symbol) {
      const cleanSymbol = symbol.replace('/', '').toUpperCase();
      queryString = `symbol=${cleanSymbol}&${queryString}`;
    }

    const signature = createBinanceSignature(queryString, apiSecret);
    const res = await fetch(`${baseUrl}${endpoint}?${queryString}&signature=${signature}`, {
      method: 'GET',
      headers: {
        'X-MBX-APIKEY': apiKey,
        'User-Agent': 'SynapseCryptoAI/1.0',
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch open orders: ${await res.text()}`);
    }

    return await res.json();
  }

  return [];
}

/**
 * Test API Key & Ping Binance Server
 */
export async function testBinanceApiConnection(
  apiKey?: string,
  apiSecret?: string,
  isTestnet: boolean = true
): Promise<{ success: boolean; pingMs: number; authenticated: boolean; message: string; balance?: any }> {
  const start = Date.now();

  try {
    const { pingFuturesRest } = await import("./exchanges/binance/futuresClient.js");
    const { classifyBinanceError, formatBinanceError } = await import("./binanceErrors.js");
    const publicOk = await pingFuturesRest(isTestnet);
    const pingMs = Date.now() - start;

    if (!publicOk) {
      return { success: false, pingMs, authenticated: false, message: 'Не удалось связаться с Binance Futures Testnet' };
    }

    if (apiKey && apiSecret && apiKey.trim().length > 10 && apiSecret.trim().length > 10) {
      try {
        const balanceInfo = await fetchBinanceAccountBalance(apiKey, apiSecret, isTestnet);
        return {
          success: true,
          pingMs,
          authenticated: true,
          message: `Соединение установлено! Доступно $${balanceInfo.availableBalanceUsdt} USDT (${isTestnet ? 'Testnet' : 'Mainnet'})`,
          balance: balanceInfo,
        };
      } catch (authErr: any) {
        const raw = String(authErr?.message || "");
        const jsonStart = raw.indexOf("{");
        const classified = classifyBinanceError(400, jsonStart >= 0 ? raw.slice(jsonStart) : raw);
        return {
          success: false,
          pingMs,
          authenticated: false,
          message: `Ошибка авторизации ключей Binance: ${formatBinanceError(classified.kind, classified.message)}`,
        };
      }
    }

    return {
      success: true,
      pingMs,
      authenticated: false,
      message: `Публичный API Binance доступен (${pingMs}мс). Ключи не введены (режим наблюдения).`,
    };
  } catch (err: any) {
    return {
      success: false,
      pingMs: 0,
      authenticated: false,
      message: `Ошибка подключения сети Binance: ${err?.message || 'Ошибка HTTP'}`,
    };
  }
}

async function signedFuturesRequest(params: {
  method: "POST" | "DELETE" | "GET";
  path: string;
  query: string;
  apiKey: string;
  apiSecret: string;
  isTestnet: boolean;
}): Promise<{ ok: boolean; status: number; data: any; text: string }> {
  const baseUrl = getBinanceBaseUrl(params.isTestnet, true);
  const signature = createBinanceSignature(params.query, params.apiSecret);
  const url = `${baseUrl}${params.path}?${params.query}&signature=${signature}`;
  const res = await fetch(url, {
    method: params.method,
    headers: {
      "X-MBX-APIKEY": params.apiKey,
      "User-Agent": "SynapseCryptoAI/1.0",
    },
  });
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data, text };
}

/** STOP_MARKET + TAKE_PROFIT_MARKET с closePosition для Futures. */
export async function placeFuturesProtectiveOrders(params: {
  symbol: string;
  side: "BUY" | "SELL";
  stopLossPrice: number;
  takeProfitPrice: number;
  apiKey: string;
  apiSecret: string;
  isTestnet?: boolean;
}): Promise<{ slOrderId?: string; tpOrderId?: string }> {
  const cleanSymbol = params.symbol.replace("/", "").toUpperCase();
  const closeSide = params.side === "BUY" ? "SELL" : "BUY";
  const timestamp = Date.now();
  const isTestnet = params.isTestnet ?? true;
  const result: { slOrderId?: string; tpOrderId?: string } = {};

  const slQuery = [
    `symbol=${cleanSymbol}`,
    `side=${closeSide}`,
    `type=STOP_MARKET`,
    `stopPrice=${params.stopLossPrice}`,
    `closePosition=true`,
    `timestamp=${timestamp}`,
    `recvWindow=5000`,
  ].join("&");

  const sl = await signedFuturesRequest({
    method: "POST",
    path: "/fapi/v1/order",
    query: slQuery,
    apiKey: params.apiKey,
    apiSecret: params.apiSecret,
    isTestnet,
  });
  if (sl.ok) result.slOrderId = String(sl.data.orderId ?? "");

  const tpQuery = [
    `symbol=${cleanSymbol}`,
    `side=${closeSide}`,
    `type=TAKE_PROFIT_MARKET`,
    `stopPrice=${params.takeProfitPrice}`,
    `closePosition=true`,
    `timestamp=${Date.now()}`,
    `recvWindow=5000`,
  ].join("&");

  const tp = await signedFuturesRequest({
    method: "POST",
    path: "/fapi/v1/order",
    query: tpQuery,
    apiKey: params.apiKey,
    apiSecret: params.apiSecret,
    isTestnet,
  });
  if (tp.ok) result.tpOrderId = String(tp.data.orderId ?? "");

  return result;
}

export async function closeFuturesMarketPosition(params: {
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  apiKey: string;
  apiSecret: string;
  isTestnet?: boolean;
}) {
  const cleanSymbol = params.symbol.replace("/", "").toUpperCase();
  const closeSide = params.side === "BUY" ? "SELL" : "BUY";
  const query = [
    `symbol=${cleanSymbol}`,
    `side=${closeSide}`,
    `type=MARKET`,
    `quantity=${params.quantity}`,
    `reduceOnly=true`,
    `timestamp=${Date.now()}`,
    `recvWindow=5000`,
  ].join("&");

  return signedFuturesRequest({
    method: "POST",
    path: "/fapi/v1/order",
    query,
    apiKey: params.apiKey,
    apiSecret: params.apiSecret,
    isTestnet: params.isTestnet ?? true,
  });
}

export async function createListenKey(params: {
  apiKey: string;
  isTestnet?: boolean;
  isFutures?: boolean;
}): Promise<string> {
  const isFutures = params.isFutures ?? true;
  const baseUrl = getBinanceBaseUrl(params.isTestnet ?? true, isFutures);
  const path = isFutures ? "/fapi/v1/listenKey" : "/api/v3/userDataStream";
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "X-MBX-APIKEY": params.apiKey, "User-Agent": "SynapseCryptoAI/1.0" },
  });
  const data = await res.json();
  if (!data.listenKey) {
    throw new Error(`Не удалось получить listenKey: ${JSON.stringify(data)}`);
  }
  return data.listenKey as string;
}

export async function keepaliveListenKey(params: {
  apiKey: string;
  listenKey: string;
  isTestnet?: boolean;
  isFutures?: boolean;
}): Promise<void> {
  const isFutures = params.isFutures ?? true;
  const baseUrl = getBinanceBaseUrl(params.isTestnet ?? true, isFutures);
  const path = isFutures ? "/fapi/v1/listenKey" : "/api/v3/userDataStream";
  await fetch(`${baseUrl}${path}`, {
    method: "PUT",
    headers: {
      "X-MBX-APIKEY": params.apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "SynapseCryptoAI/1.0",
    },
    body: `listenKey=${params.listenKey}`,
  });
}

