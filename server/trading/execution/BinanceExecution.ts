import type { ExecutionFill, ExecutionProvider } from "./ExecutionProvider.js";
import type { TradingMode } from "../types.js";
import {
  cancelAllFuturesOrders,
  cancelFuturesOrder,
  commissionForOrder,
  getFuturesAccount,
  getPositionRisk,
  listOpenFuturesOrders,
  placeFuturesOrder,
  queryFuturesOrder,
  setLeverage,
  waitForFill,
} from "../../exchanges/binance/futuresClient.js";
import { meetsMinNotional, roundPrice, roundQty } from "../../exchanges/binance/precision.js";
import { logger } from "../../logger.js";

function isWorkingAlgo(status: string) {
  return /^(NEW|PARTIALLY_FILLED|FILLED)$/i.test(status);
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export class BinanceExecution implements ExecutionProvider {
  constructor(
    public mode: TradingMode,
    private apiKey: string,
    private apiSecret: string,
    private isTestnet: boolean
  ) {}

  private async resolveFill(symbol: string, clientOrderId: string, placed: { orderId: string; avgPrice: number; executedQty: number; status: string }): Promise<ExecutionFill> {
    let snap = placed;
    if (placed.status !== "FILLED") {
      try {
        snap = await waitForFill({
          apiKey: this.apiKey,
          apiSecret: this.apiSecret,
          isTestnet: this.isTestnet,
          symbol,
          origClientOrderId: clientOrderId,
        });
      } catch (err) {
        const existing = await queryFuturesOrder({
          apiKey: this.apiKey,
          apiSecret: this.apiSecret,
          isTestnet: this.isTestnet,
          symbol,
          origClientOrderId: clientOrderId,
        });
        if (!existing || existing.status !== "FILLED") {
          throw err;
        }
        snap = existing;
      }
    }
    const fees = await commissionForOrder({
      apiKey: this.apiKey,
      apiSecret: this.apiSecret,
      isTestnet: this.isTestnet,
      symbol,
      orderId: snap.orderId,
    });
    const qty = fees.qty || snap.executedQty;
    const fillPrice = fees.avgPrice || snap.avgPrice;
    if (qty <= 0) {
      return {
        orderId: snap.orderId,
        clientOrderId,
        status: "FAILED",
        fillPrice: 0,
        quantity: 0,
        feesUsdt: 0,
        isPaper: false,
      };
    }
    return {
      orderId: snap.orderId,
      clientOrderId,
      status: snap.status === "PARTIALLY_FILLED" ? "PARTIALLY_FILLED" : "FILLED",
      fillPrice,
      quantity: qty,
      feesUsdt: fees.feesUsdt,
      isPaper: false,
    };
  }

  async openMarket(params: {
    symbol: string;
    side: "BUY" | "SELL";
    quantity: number;
    markPrice: number;
    clientOrderId: string;
  }): Promise<ExecutionFill> {
    const existing = await this.queryOrder(params.clientOrderId, params.symbol);
    if (existing?.status === "FILLED" || existing?.status === "PARTIALLY_FILLED") return existing;

    const qty = roundQty(params.symbol, params.quantity, this.isTestnet);
    if (!meetsMinNotional(params.symbol, qty, params.markPrice, this.isTestnet)) {
      return {
        orderId: "",
        clientOrderId: params.clientOrderId,
        status: "REJECTED",
        fillPrice: 0,
        quantity: 0,
        feesUsdt: 0,
        isPaper: false,
      };
    }
    const placed = await placeFuturesOrder(this.apiKey, this.apiSecret, this.isTestnet, {
      symbol: params.symbol,
      side: params.side,
      type: "MARKET",
      quantity: qty,
      newClientOrderId: params.clientOrderId,
    });
    return this.resolveFill(params.symbol, params.clientOrderId, placed);
  }

  async closeMarket(params: {
    symbol: string;
    side: "BUY" | "SELL";
    quantity: number;
    markPrice: number;
    clientOrderId: string;
    reduceOnly?: boolean;
  }): Promise<ExecutionFill> {
    const existing = await this.queryOrder(params.clientOrderId, params.symbol);
    if (existing?.status === "FILLED") return existing;

    const closeSide = params.side === "BUY" ? "SELL" : "BUY";
    const positions = await getPositionRisk(this.apiKey, this.apiSecret, this.isTestnet, params.symbol);
    const row = positions.find((p) => p.symbol === params.symbol.replace("/", "").toUpperCase());
    const amt = row ? Math.abs(row.positionAmt) : params.quantity;
    const qty = roundQty(params.symbol, amt || params.quantity, this.isTestnet);
    if (qty <= 0) {
      return {
        orderId: "FLAT",
        clientOrderId: params.clientOrderId,
        status: "FILLED",
        fillPrice: params.markPrice,
        quantity: 0,
        feesUsdt: 0,
        isPaper: false,
      };
    }
    const placed = await placeFuturesOrder(this.apiKey, this.apiSecret, this.isTestnet, {
      symbol: params.symbol,
      side: closeSide,
      type: "MARKET",
      quantity: qty,
      reduceOnly: params.reduceOnly !== false,
      newClientOrderId: params.clientOrderId,
    });
    return this.resolveFill(params.symbol, params.clientOrderId, placed);
  }

  async placeProtection(params: {
    symbol: string;
    entrySide: "BUY" | "SELL";
    stopLoss: number;
    takeProfit: number;
    slClientId: string;
    tpClientId: string;
    quantity: number;
    takeProfits?: { price: number; quantity: number; clientOrderId: string }[];
  }) {
    const closeSide = params.entrySide === "BUY" ? "SELL" : "BUY";
    const qty = roundQty(params.symbol, params.quantity, this.isTestnet);
    const sl = await this.placeAlgoWithRetry({
      symbol: params.symbol,
      side: closeSide,
      type: "STOP_MARKET",
      stopPrice: roundPrice(params.symbol, params.stopLoss, this.isTestnet),
      quantity: qty,
      clientOrderId: params.slClientId,
      closePosition: true,
    });
    const legs =
      params.takeProfits && params.takeProfits.length > 0
        ? params.takeProfits
        : [{ price: params.takeProfit, quantity: qty, clientOrderId: params.tpClientId }];
    const tpOrderIds: string[] = [];
    for (const leg of legs) {
      const tpQty = roundQty(params.symbol, leg.quantity, this.isTestnet);
      if (tpQty <= 0) continue;
      const tp = await this.placeAlgoWithRetry({
        symbol: params.symbol,
        side: closeSide,
        type: "TAKE_PROFIT_MARKET",
        stopPrice: roundPrice(params.symbol, leg.price, this.isTestnet),
        quantity: tpQty,
        clientOrderId: leg.clientOrderId,
      });
      if (tp.orderId) tpOrderIds.push(tp.orderId);
    }
    return { slOrderId: sl.orderId, tpOrderId: tpOrderIds[0], tpOrderIds };
  }

  private async placeAlgoWithRetry(params: {
    symbol: string;
    side: "BUY" | "SELL";
    type: "STOP_MARKET" | "TAKE_PROFIT_MARKET";
    stopPrice: number;
    quantity: number;
    clientOrderId: string;
    closePosition?: boolean;
  }) {
    let lastErr = "algo not acknowledged";
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const existing = await queryFuturesOrder({
          apiKey: this.apiKey,
          apiSecret: this.apiSecret,
          isTestnet: this.isTestnet,
          symbol: params.symbol,
          origClientOrderId: params.clientOrderId,
        });
        if (existing?.orderId && isWorkingAlgo(existing.status)) {
          return existing;
        }
        const placed = await placeFuturesOrder(this.apiKey, this.apiSecret, this.isTestnet, {
          symbol: params.symbol,
          side: params.side,
          type: params.type,
          stopPrice: params.stopPrice,
          quantity: params.closePosition ? undefined : params.quantity,
          reduceOnly: params.closePosition ? undefined : true,
          closePosition: params.closePosition || undefined,
          newClientOrderId: params.clientOrderId,
        });
        const confirmed = await queryFuturesOrder({
          apiKey: this.apiKey,
          apiSecret: this.apiSecret,
          isTestnet: this.isTestnet,
          symbol: params.symbol,
          origClientOrderId: params.clientOrderId,
        });
        const snap = confirmed || placed;
        if (snap.orderId && isWorkingAlgo(snap.status || "NEW")) {
          return snap;
        }
        lastErr = `algo status ${snap.status || "empty"}`;
      } catch (err) {
        lastErr = err instanceof Error ? err.message : String(err);
        const existing = await queryFuturesOrder({
          apiKey: this.apiKey,
          apiSecret: this.apiSecret,
          isTestnet: this.isTestnet,
          symbol: params.symbol,
          origClientOrderId: params.clientOrderId,
        }).catch(() => null);
        if (existing?.orderId && isWorkingAlgo(existing.status)) return existing;
      }
      await sleep(400 * attempt);
    }
    throw new Error(`${params.type} confirm failed: ${lastErr}`);
  }

  async replaceStop(params: {
    symbol: string;
    entrySide: "BUY" | "SELL";
    stopLoss: number;
    quantity: number;
    oldSlOrderId?: string | null;
    slClientId: string;
  }) {
    const closeSide = params.entrySide === "BUY" ? "SELL" : "BUY";
    const placed = await this.placeAlgoWithRetry({
      symbol: params.symbol,
      side: closeSide,
      type: "STOP_MARKET",
      stopPrice: roundPrice(params.symbol, params.stopLoss, this.isTestnet),
      quantity: roundQty(params.symbol, params.quantity, this.isTestnet),
      clientOrderId: params.slClientId,
      closePosition: true,
    });
    if (params.oldSlOrderId) {
      await this.cancelProtective({ symbol: params.symbol, slOrderId: params.oldSlOrderId });
    }
    return { slOrderId: placed.orderId };
  }

  async listOpenOrders(symbol?: string) {
    const rows = await listOpenFuturesOrders({
      apiKey: this.apiKey,
      apiSecret: this.apiSecret,
      isTestnet: this.isTestnet,
      symbol,
    });
    return rows.map((r) => ({
      orderId: r.orderId,
      clientOrderId: r.clientOrderId,
      symbol: r.symbol,
      status: r.status,
      type: r.type,
    }));
  }

  async cancelProtective(params: { symbol: string; slOrderId?: string | null; tpOrderId?: string | null }) {
    for (const orderId of [params.slOrderId, params.tpOrderId]) {
      if (!orderId) continue;
      try {
        await cancelFuturesOrder({
          apiKey: this.apiKey,
          apiSecret: this.apiSecret,
          isTestnet: this.isTestnet,
          symbol: params.symbol,
          orderId,
        });
      } catch (err) {
        logger.warn({ err, orderId }, "cancel protective failed");
      }
    }
  }

  async cancelAllOrders(symbol?: string) {
    await cancelAllFuturesOrders({
      apiKey: this.apiKey,
      apiSecret: this.apiSecret,
      isTestnet: this.isTestnet,
      symbol,
    });
  }

  async getBalance() {
    const acc = await getFuturesAccount(this.apiKey, this.apiSecret, this.isTestnet);
    return { equity: acc.totalEquityUsdt, available: acc.availableBalanceUsdt };
  }

  async getExchangePositions(symbol?: string) {
    return getPositionRisk(this.apiKey, this.apiSecret, this.isTestnet, symbol);
  }

  async queryOrder(clientOrderId: string, symbol: string): Promise<ExecutionFill | null> {
    const snap = await queryFuturesOrder({
      apiKey: this.apiKey,
      apiSecret: this.apiSecret,
      isTestnet: this.isTestnet,
      symbol,
      origClientOrderId: clientOrderId,
    });
    if (!snap) return null;
    const fees = snap.orderId
      ? await commissionForOrder({
          apiKey: this.apiKey,
          apiSecret: this.apiSecret,
          isTestnet: this.isTestnet,
          symbol,
          orderId: snap.orderId,
        })
      : { feesUsdt: 0, avgPrice: 0, qty: 0 };
    const status =
      snap.status === "FILLED" ? "FILLED" : snap.status === "PARTIALLY_FILLED" ? "PARTIALLY_FILLED" : "FAILED";
    return {
      orderId: snap.orderId,
      clientOrderId,
      status: status as ExecutionFill["status"],
      fillPrice: fees.avgPrice || snap.avgPrice,
      quantity: fees.qty || snap.executedQty,
      feesUsdt: fees.feesUsdt,
      isPaper: false,
    };
  }

  async applyLeverage(symbol: string, leverage: number) {
    return setLeverage({
      apiKey: this.apiKey,
      apiSecret: this.apiSecret,
      isTestnet: this.isTestnet,
      symbol,
      leverage,
    });
  }
}
