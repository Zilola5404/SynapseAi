import { pingFuturesRest, getFuturesAccount } from "../../exchanges/binance/futuresClient.js";
import { meetsMinNotional, minTradeQty } from "../../exchanges/binance/precision.js";
import { fetchLastPrice } from "../../market/markPrice.js";
import { resolveTestnetCredentials } from "../../services/credentialService.js";

export type PreflightStep = { name: string; ok: boolean; detail: string };

export function evaluatePrecisionGate(params: {
  symbol: string;
  price: number;
  isTestnet?: boolean;
}): { ok: boolean; qty: number; minNotionalOk: boolean } {
  const isTestnet = params.isTestnet !== false;
  const qty = minTradeQty(params.symbol, params.price, isTestnet);
  const minNotionalOk = qty > 0 && meetsMinNotional(params.symbol, qty, params.price, isTestnet);
  return { ok: qty > 0 && minNotionalOk, qty, minNotionalOk };
}

export async function runTestnetPreflight(userId: string, symbol = "BTCUSDT"): Promise<{
  ok: boolean;
  steps: PreflightStep[];
  qty: number;
  price: number;
  equity: number;
}> {
  const steps: PreflightStep[] = [];
  const ping = await pingFuturesRest(true);
  steps.push({ name: "api", ok: ping, detail: ping ? "Futures Demo REST reachable" : "Futures Demo REST down" });

  const keys = await resolveTestnetCredentials(userId);
  steps.push({
    name: "keys",
    ok: Boolean(keys?.apiKey && keys.apiSecret),
    detail: keys ? "API key+secret present (masked)" : "No Testnet keys",
  });
  steps.push({
    name: "testnet",
    ok: Boolean(keys),
    detail: keys ? `source=${keys.source} Testnet=true` : "No Testnet keys",
  });

  let equity = 0;
  if (keys) {
    try {
      const acc = await getFuturesAccount(keys.apiKey, keys.apiSecret, true);
      equity = acc.totalEquityUsdt;
      steps.push({ name: "balance", ok: equity > 0, detail: `equity=${equity.toFixed(2)}` });
    } catch (err) {
      steps.push({
        name: "balance",
        ok: false,
        detail: err instanceof Error ? err.message.slice(0, 120) : "account failed",
      });
    }
  } else {
    steps.push({ name: "balance", ok: false, detail: "skipped" });
  }

  const price = (await fetchLastPrice(symbol)) || 0;
  steps.push({ name: "price", ok: price > 0, detail: price > 0 ? String(price) : "no mark" });
  steps.push({ name: "symbol", ok: Boolean(symbol), detail: symbol });

  const gate = evaluatePrecisionGate({ symbol, price: price || 1, isTestnet: true });
  steps.push({
    name: "precision",
    ok: price > 0 && gate.ok,
    detail: `qty=${gate.qty} minNotional=${gate.minNotionalOk}`,
  });

  return { ok: steps.every((s) => s.ok), steps, qty: gate.qty, price, equity };
}
