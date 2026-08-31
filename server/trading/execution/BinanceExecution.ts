import type { ExecutionFill, ExecutionProvider } from "./ExecutionProvider.js";
import type { TradingMode } from "../types.js";
import {
  cancelAllFuturesOrders,
  cancelFuturesOrder,
  commissionForOrder,
  getFuturesAccount,
  getPositionRisk,
  placeFuturesOrder,
  queryFuturesOrder,
  setLeverage,
  waitForFill,
} from "../../exchanges/binance/futuresClient.js";
import { meetsMinNotional, roundPrice, roundQty } from "../../exchanges/binance/precision.js";
import { logger } from "../../logger.js";

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
  }) {
    const closeSide = params.entrySide === "BUY" ? "SELL" : "BUY";
    const slPrice = roundPrice(params.symbol, params.stopLoss, this.isTestnet);
    const tpPrice = roundPrice(params.symbol, params.takeProfit, this.isTestnet);
    const sl = await placeFuturesOrder(this.apiKey, this.apiSecret, this.isTestnet, {
      symbol: params.symbol,
      side: closeSide,
      type: "STOP_MARKET",
      stopPrice: slPrice,
      closePosition: true,
      newClientOrderId: params.slClientId,
    });
    const tp = await placeFuturesOrder(this.apiKey, this.apiSecret, this.isTestnet, {
      symbol: params.symbol,
      side: closeSide,
      type: "TAKE_PROFIT_MARKET",
      stopPrice: tpPrice,
      closePosition: true,
      newClientOrderId: params.tpClientId,
    });
    return { slOrderId: sl.orderId, tpOrderId: tp.orderId };
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
