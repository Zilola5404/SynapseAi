import {
  BINANCE_FUTURES_TESTNET_URL_DEFAULT,
  BINANCE_FUTURES_TESTNET_URL_LEGACY,
  createBinanceSignature,
  getBinanceBaseUrl,
} from "../../binance.js";
import { logger } from "../../logger.js";
import { BINANCE_RECV_WINDOW, binanceTimestamp, ensureBinanceTime, syncBinanceServerTime } from "./timeSync.js";

let resolvedTestnetBase: string | undefined;

function futuresRestBase(isTestnet: boolean, override?: string) {
  if (override) return override.replace(/\/$/, "");
  if (!isTestnet) return getBinanceBaseUrl(false, true);
  return resolvedTestnetBase || getBinanceBaseUrl(true, true);
}

function alternateTestnetBase(current: string) {
  const cur = current.replace(/\/$/, "");
  return cur === BINANCE_FUTURES_TESTNET_URL_LEGACY
    ? BINANCE_FUTURES_TESTNET_URL_DEFAULT
    : BINANCE_FUTURES_TESTNET_URL_LEGACY;
}

export interface FuturesOrderParams {
  symbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT" | "STOP_MARKET" | "TAKE_PROFIT_MARKET" | "TRAILING_STOP_MARKET";
  quantity?: number;
  price?: number;
  stopPrice?: number;
  reduceOnly?: boolean;
  closePosition?: boolean;
  callbackRate?: number;
  newClientOrderId: string;
  timeInForce?: "GTC" | "IOC" | "FOK";
}

export interface FuturesOrderSnapshot {
  orderId: string;
  clientOrderId: string;
  symbol: string;
  status: string;
  side: string;
  type: string;
  origQty: number;
  executedQty: number;
  avgPrice: number;
  price: number;
  reduceOnly: boolean;
}

async function signed(
  params: {
    method: "GET" | "POST" | "DELETE" | "PUT";
    path: string;
    query: Record<string, string | number | boolean | undefined>;
    apiKey: string;
    apiSecret: string;
    isTestnet: boolean;
    baseUrl?: string;
  },
  retried = false,
  hostTried = false
): Promise<{ ok: boolean; status: number; data: any; text: string }> {
  const base = futuresRestBase(params.isTestnet, params.baseUrl);
  await ensureBinanceTime(params.isTestnet, true);
  const pairs: string[] = [];
  for (const [k, v] of Object.entries(params.query)) {
    if (v === undefined || v === "") continue;
    pairs.push(`${k}=${v}`);
  }
  pairs.push(`timestamp=${binanceTimestamp()}`);
  pairs.push(`recvWindow=${BINANCE_RECV_WINDOW}`);
  const qs = pairs.join("&");
  const signature = createBinanceSignature(qs, params.apiSecret);
  const url = `${base}${params.path}?${qs}&signature=${signature}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, {
      method: params.method,
      headers: { "X-MBX-APIKEY": params.apiKey, "User-Agent": "SynapseCryptoAI/1.0" },
      signal: controller.signal,
    });
    const text = await res.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    if (!res.ok && Number(data?.code) === -1021 && !retried) {
      logger.warn("Binance -1021 timestamp, resync server time and retry once");
      await syncBinanceServerTime(params.isTestnet, true, base);
      return signed(params, true, hostTried);
    }
    if (!res.ok && Number(data?.code) === -2015 && params.isTestnet && !hostTried) {
      const alt = alternateTestnetBase(base);
      logger.warn({ from: base, to: alt }, "Binance -2015, trying alternate Futures Testnet/Demo host");
      await syncBinanceServerTime(true, true, alt);
      return signed({ ...params, baseUrl: alt }, retried, true);
    }
    if (res.ok && params.isTestnet) resolvedTestnetBase = base;
    return { ok: res.ok, status: res.status, data, text };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ err: message, path: params.path }, "futures signed request failed");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function snapshot(data: any, fallbackClientId: string): FuturesOrderSnapshot {
  return {
    orderId: String(data.orderId ?? ""),
    clientOrderId: String(data.clientOrderId || data.origClientOrderId || fallbackClientId),
    symbol: String(data.symbol || ""),
    status: String(data.status || "UNKNOWN"),
    side: String(data.side || ""),
    type: String(data.type || ""),
    origQty: parseFloat(data.origQty || "0"),
    executedQty: parseFloat(data.executedQty || "0"),
    avgPrice: parseFloat(data.avgPrice || data.price || "0"),
    price: parseFloat(data.price || "0"),
    reduceOnly: Boolean(data.reduceOnly),
  };
}

export async function getFuturesExchangeInfo(isTestnet: boolean) {
  const url = `${futuresRestBase(isTestnet)}/fapi/v1/exchangeInfo`;
  const res = await fetch(url, { headers: { "User-Agent": "SynapseCryptoAI/1.0" } });
  if (!res.ok) throw new Error(`exchangeInfo ${res.status}`);
  return res.json();
}

export async function getFuturesAccount(apiKey: string, apiSecret: string, isTestnet: boolean) {
  const r = await signed({
    method: "GET",
    path: "/fapi/v2/account",
    query: {},
    apiKey,
    apiSecret,
    isTestnet,
  });
  if (!r.ok) throw new Error(`futures account ${r.status}: ${r.text}`);
  return {
    totalEquityUsdt: Number(parseFloat(r.data.totalMarginBalance || r.data.totalWalletBalance || "0").toFixed(4)),
    availableBalanceUsdt: Number(parseFloat(r.data.availableBalance || "0").toFixed(4)),
    raw: r.data,
  };
}

export async function getPositionRisk(
  apiKey: string,
  apiSecret: string,
  isTestnet: boolean,
  symbol?: string
) {
  const r = await signed({
    method: "GET",
    path: "/fapi/v2/positionRisk",
    query: symbol ? { symbol: symbol.replace("/", "").toUpperCase() } : {},
    apiKey,
    apiSecret,
    isTestnet,
  });
  if (!r.ok) throw new Error(`positionRisk ${r.status}: ${r.text}`);
  return (Array.isArray(r.data) ? r.data : []).map((p: any) => ({
    symbol: String(p.symbol),
    positionAmt: parseFloat(p.positionAmt || "0"),
    entryPrice: parseFloat(p.entryPrice || "0"),
    markPrice: parseFloat(p.markPrice || "0"),
    unRealizedProfit: parseFloat(p.unRealizedProfit || "0"),
    leverage: parseInt(p.leverage || "1", 10),
  }));
}

export async function placeFuturesOrder(
  apiKey: string,
  apiSecret: string,
  isTestnet: boolean,
  params: FuturesOrderParams
): Promise<FuturesOrderSnapshot> {
  const r = await signed({
    method: "POST",
    path: "/fapi/v1/order",
    query: {
      symbol: params.symbol.replace("/", "").toUpperCase(),
      side: params.side,
      type: params.type,
      quantity: params.closePosition ? undefined : params.quantity,
      price: params.price,
      stopPrice: params.stopPrice,
      reduceOnly: params.reduceOnly ? "true" : undefined,
      closePosition: params.closePosition ? "true" : undefined,
      callbackRate: params.callbackRate,
      newClientOrderId: params.newClientOrderId,
      timeInForce: params.type === "LIMIT" ? params.timeInForce || "GTC" : undefined,
    },
    apiKey,
    apiSecret,
    isTestnet,
  });
  if (!r.ok) {
    if (Number(r.data?.code) === -4120) {
      return placeFuturesAlgoOrder(apiKey, apiSecret, isTestnet, params);
    }
    throw new Error(`place order ${r.status}: ${r.text}`);
  }
  return snapshot(r.data, params.newClientOrderId);
}

export async function placeFuturesAlgoOrder(
  apiKey: string,
  apiSecret: string,
  isTestnet: boolean,
  params: FuturesOrderParams
): Promise<FuturesOrderSnapshot> {
  const r = await signed({
    method: "POST",
    path: "/fapi/v1/algoOrder",
    query: {
      algoType: "CONDITIONAL",
      symbol: params.symbol.replace("/", "").toUpperCase(),
      side: params.side,
      type: params.type,
      triggerPrice: params.stopPrice,
      quantity: params.closePosition ? undefined : params.quantity,
      closePosition: params.closePosition ? "true" : undefined,
      reduceOnly: params.reduceOnly ? "true" : undefined,
      clientAlgoId: params.newClientOrderId,
      workingType: "MARK_PRICE",
    },
    apiKey,
    apiSecret,
    isTestnet,
  });
  if (!r.ok) throw new Error(`place algo ${r.status}: ${r.text}`);
  return {
    ...snapshot(r.data, params.newClientOrderId),
    orderId: String(r.data.algoId ?? r.data.orderId ?? ""),
    clientOrderId: String(r.data.clientAlgoId || r.data.clientOrderId || params.newClientOrderId),
    status: String(r.data.algoStatus || r.data.status || "NEW"),
  };
}

export async function queryFuturesOrder(params: {
  apiKey: string;
  apiSecret: string;
  isTestnet: boolean;
  symbol: string;
  orderId?: string;
  origClientOrderId?: string;
}): Promise<FuturesOrderSnapshot | null> {
  const r = await signed({
    method: "GET",
    path: "/fapi/v1/order",
    query: {
      symbol: params.symbol.replace("/", "").toUpperCase(),
      orderId: params.orderId,
      origClientOrderId: params.origClientOrderId,
    },
    apiKey: params.apiKey,
    apiSecret: params.apiSecret,
    isTestnet: params.isTestnet,
  });
  if (!r.ok) {
    const code = Number(r.data?.code);
    if (code === -2013 || /unknown order|does not exist/i.test(r.text)) return null;
    throw new Error(`query order ${r.status}: ${r.text}`);
  }
  return snapshot(r.data, params.origClientOrderId || "");
}

export async function listOpenFuturesOrders(params: {
  apiKey: string;
  apiSecret: string;
  isTestnet: boolean;
  symbol?: string;
}): Promise<FuturesOrderSnapshot[]> {
  const r = await signed({
    method: "GET",
    path: "/fapi/v1/openOrders",
    query: { symbol: params.symbol ? params.symbol.replace("/", "").toUpperCase() : undefined },
    apiKey: params.apiKey,
    apiSecret: params.apiSecret,
    isTestnet: params.isTestnet,
  });
  if (!r.ok) throw new Error(`openOrders ${r.status}: ${r.text}`);
  const rows = Array.isArray(r.data) ? r.data : [];
  const algo = await signed({
    method: "GET",
    path: "/fapi/v1/openAlgoOrders",
    query: { symbol: params.symbol ? params.symbol.replace("/", "").toUpperCase() : undefined },
    apiKey: params.apiKey,
    apiSecret: params.apiSecret,
    isTestnet: params.isTestnet,
  }).catch(() => ({ ok: false, data: [] as unknown[] }));
  const algoRows = Array.isArray(algo.data) ? algo.data : [];
  return [...rows, ...algoRows].map((row: any) =>
    snapshot(
      {
        ...row,
        orderId: row.orderId ?? row.algoId,
        clientOrderId: row.clientOrderId || row.clientAlgoId,
        status: row.status || row.algoStatus || "NEW",
      },
      String(row.clientOrderId || row.clientAlgoId || "")
    )
  );
}

export async function pingFuturesRest(isTestnet = true): Promise<boolean> {
  const bases = isTestnet
    ? [...new Set([futuresRestBase(true), BINANCE_FUTURES_TESTNET_URL_DEFAULT, BINANCE_FUTURES_TESTNET_URL_LEGACY])]
    : [getBinanceBaseUrl(false, true)];
  for (const base of bases) {
    try {
      const res = await fetch(`${base}/fapi/v1/ping`, {
        signal: AbortSignal.timeout(4000),
        headers: { "User-Agent": "SynapseCryptoAI/1.0" },
      });
      if (res.ok) {
        if (isTestnet) resolvedTestnetBase = base;
        return true;
      }
    } catch {
      /* try next host */
    }
  }
  return false;
}

export async function waitForFill(params: {
  apiKey: string;
  apiSecret: string;
  isTestnet: boolean;
  symbol: string;
  origClientOrderId: string;
  timeoutMs?: number;
}): Promise<FuturesOrderSnapshot> {
  const deadline = Date.now() + (params.timeoutMs ?? 12_000);
  let last: FuturesOrderSnapshot | null = null;
  while (Date.now() < deadline) {
    last = await queryFuturesOrder({
      apiKey: params.apiKey,
      apiSecret: params.apiSecret,
      isTestnet: params.isTestnet,
      symbol: params.symbol,
      origClientOrderId: params.origClientOrderId,
    });
    if (last && (last.status === "FILLED" || last.status === "CANCELED" || last.status === "EXPIRED" || last.status === "REJECTED")) {
      if (last.status !== "FILLED") throw new Error(`Ордер ${last.clientOrderId} ${last.status}`);
      return last;
    }
    if (last && last.status === "PARTIALLY_FILLED" && last.executedQty > 0) {
      await new Promise((r) => setTimeout(r, 400));
      continue;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  if (last?.status === "FILLED") return last;
  throw new Error(`Timeout waiting fill ${params.origClientOrderId} last=${last?.status || "UNKNOWN"}`);
}

export async function getUserTrades(params: {
  apiKey: string;
  apiSecret: string;
  isTestnet: boolean;
  symbol: string;
  orderId?: string;
}): Promise<{ qty: number; price: number; commission: number }[]> {
  const r = await signed({
    method: "GET",
    path: "/fapi/v1/userTrades",
    query: {
      symbol: params.symbol.replace("/", "").toUpperCase(),
      orderId: params.orderId,
    },
    apiKey: params.apiKey,
    apiSecret: params.apiSecret,
    isTestnet: params.isTestnet,
  });
  if (!r.ok) return [];
  return (Array.isArray(r.data) ? r.data : []).map((t: any) => ({
    qty: parseFloat(t.qty || "0"),
    price: parseFloat(t.price || "0"),
    commission: parseFloat(t.commission || "0"),
  }));
}

export async function cancelAllFuturesOrders(params: {
  apiKey: string;
  apiSecret: string;
  isTestnet: boolean;
  symbol?: string;
}) {
  let symbols: string[];
  if (params.symbol) {
    symbols = [params.symbol.replace("/", "").toUpperCase()];
  } else {
    const [risk, open] = await Promise.all([
      getPositionRisk(params.apiKey, params.apiSecret, params.isTestnet),
      listOpenFuturesOrders({
        apiKey: params.apiKey,
        apiSecret: params.apiSecret,
        isTestnet: params.isTestnet,
      }).catch(() => [] as FuturesOrderSnapshot[]),
    ]);
    symbols = [
      ...new Set([
        ...risk.filter((p) => Math.abs(p.positionAmt) > 1e-8).map((p) => p.symbol),
        ...open.map((o) => o.symbol).filter(Boolean),
      ]),
    ];
  }
  if (symbols.length === 0) return [];
  const results = [];
  for (const symbol of symbols) {
    results.push(
      await signed({
        method: "DELETE",
        path: "/fapi/v1/allOpenOrders",
        query: { symbol },
        apiKey: params.apiKey,
        apiSecret: params.apiSecret,
        isTestnet: params.isTestnet,
      })
    );
    results.push(
      await signed({
        method: "DELETE",
        path: "/fapi/v1/algoOpenOrders",
        query: { symbol },
        apiKey: params.apiKey,
        apiSecret: params.apiSecret,
        isTestnet: params.isTestnet,
      })
    );
  }
  return results;
}

export async function cancelFuturesOrder(params: {
  apiKey: string;
  apiSecret: string;
  isTestnet: boolean;
  symbol: string;
  orderId?: string;
  origClientOrderId?: string;
}) {
  return signed({
    method: "DELETE",
    path: "/fapi/v1/order",
    query: {
      symbol: params.symbol.replace("/", "").toUpperCase(),
      orderId: params.orderId,
      origClientOrderId: params.origClientOrderId,
    },
    apiKey: params.apiKey,
    apiSecret: params.apiSecret,
    isTestnet: params.isTestnet,
  });
}

export async function cancelFuturesAlgoOrder(params: {
  apiKey: string;
  apiSecret: string;
  isTestnet: boolean;
  symbol: string;
  algoId?: string;
  clientAlgoId?: string;
}) {
  return signed({
    method: "DELETE",
    path: "/fapi/v1/algoOrder",
    query: {
      symbol: params.symbol.replace("/", "").toUpperCase(),
      algoId: params.algoId,
      clientAlgoId: params.clientAlgoId,
    },
    apiKey: params.apiKey,
    apiSecret: params.apiSecret,
    isTestnet: params.isTestnet,
  });
}

export async function setLeverage(params: {
  apiKey: string;
  apiSecret: string;
  isTestnet: boolean;
  symbol: string;
  leverage: number;
}) {
  return signed({
    method: "POST",
    path: "/fapi/v1/leverage",
    query: {
      symbol: params.symbol.replace("/", "").toUpperCase(),
      leverage: params.leverage,
    },
    apiKey: params.apiKey,
    apiSecret: params.apiSecret,
    isTestnet: params.isTestnet,
  });
}

export async function commissionForOrder(params: {
  apiKey: string;
  apiSecret: string;
  isTestnet: boolean;
  symbol: string;
  orderId: string;
}): Promise<{ feesUsdt: number; avgPrice: number; qty: number }> {
  const trades = await getUserTrades(params);
  if (trades.length === 0) return { feesUsdt: 0, avgPrice: 0, qty: 0 };
  const qty = trades.reduce((s, t) => s + t.qty, 0);
  const notional = trades.reduce((s, t) => s + t.qty * t.price, 0);
  const feesUsdt = trades.reduce((s, t) => s + t.commission, 0);
  return { feesUsdt, avgPrice: qty > 0 ? notional / qty : 0, qty };
}
