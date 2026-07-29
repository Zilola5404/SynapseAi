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

export function getBinanceBaseUrl(isTestnet: boolean = true, isFutures: boolean = false): string {
  if (isFutures) {
    return isTestnet ? 'https://testnet.binancefuture.com' : 'https://fapi.binance.com';
  }
  return isTestnet ? 'https://testnet.binance.vision' : 'https://api.binance.com';
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
  isTestnet: boolean = false
): Promise<{ candles: BinanceCandle[]; indicators: TechnicalIndicators }> {
  const baseUrl = getBinanceBaseUrl(isTestnet, false);
  const cleanSymbol = symbol.replace('/', '').toUpperCase();
  const url = `${baseUrl}/api/v3/klines?symbol=${cleanSymbol}&interval=${interval}&limit=${limit}`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'SynapseCryptoAI/1.0' },
  });

  if (!res.ok) {
    throw new Error(`Binance Klines HTTP Error: ${res.status} ${res.statusText}`);
  }

  const rawData = await res.json();
  const candles: BinanceCandle[] = rawData.map((k: any) => ({
    openTime: k[0],
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
    closeTime: k[6],
  }));

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
  const baseUrl = getBinanceBaseUrl(isTestnet, false);
  const timestamp = Date.now();
  const queryString = `recvWindow=5000&timestamp=${timestamp}`;
  const signature = createBinanceSignature(queryString, apiSecret);

  const url = `${baseUrl}/api/v3/account?${queryString}&signature=${signature}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'X-MBX-APIKEY': apiKey,
      'User-Agent': 'SynapseCryptoAI/1.0',
    },
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Binance Account Auth Failed (${res.status}): ${errBody}`);
  }

  const accountData = await res.json();
  const balances = accountData.balances || [];

  // Find USDT free and total balance
  const usdtObj = balances.find((b: any) => b.asset === 'USDT');
  const freeUsdt = usdtObj ? parseFloat(usdtObj.free) : 0;
  const lockedUsdt = usdtObj ? parseFloat(usdtObj.locked) : 0;

  return {
    totalEquityUsdt: Number((freeUsdt + lockedUsdt).toFixed(2)),
    availableBalanceUsdt: Number(freeUsdt.toFixed(2)),
    balances: balances.filter((b: any) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0),
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
      console.warn('Binance real order API call returned error:', errText);
      throw new Error(`Ошибка ответа Binance (${res.status}): ${errText}`);
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
  const simulatedPrice = price && price > 0 ? price : 50000;
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
  const baseUrl = getBinanceBaseUrl(isTestnet, false);
  const start = Date.now();

  try {
    const pingRes = await fetch(`${baseUrl}/api/v3/ping`);
    const pingMs = Date.now() - start;

    if (!pingRes.ok) {
      return { success: false, pingMs, authenticated: false, message: 'Не удалось связаться с серверами Binance' };
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
        return {
          success: false,
          pingMs,
          authenticated: false,
          message: `Ошибка авторизации ключей Binance: ${authErr?.message || 'Неверный API key/secret'}`,
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
