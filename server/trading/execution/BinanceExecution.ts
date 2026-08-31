import { placeBinanceOrder, closeFuturesMarketPosition, placeFuturesProtectiveOrders } from "../../binance.js";
import { roundQty } from "../../exchanges/binance/precision.js";
import type { ExecutionFill, ExecutionProvider } from "./ExecutionProvider.js";
import type { TradingMode } from "../types.js";

export class BinanceExecution implements ExecutionProvider {
  constructor(
    public mode: TradingMode,
    private apiKey: string,
    private apiSecret: string,
    private isTestnet: boolean
  ) {}

  async openMarket(params: {
    symbol: string;
    side: "BUY" | "SELL";
    quantity: number;
    markPrice: number;
  }): Promise<ExecutionFill> {
    const qty = roundQty(params.symbol, params.quantity);
    const order = await placeBinanceOrder({
      symbol: params.symbol,
      side: params.side,
      type: "MARKET",
      quantity: qty,
      markPrice: params.markPrice,
      isFutures: true,
      isTestnet: this.isTestnet,
      apiKey: this.apiKey,
      apiSecret: this.apiSecret,
    });
    if (order.isPaperTrade) {
      throw new Error("Ключи Binance отклонены, live/testnet ордер не отправлен (paper fallback запрещён в этом режиме)");
    }
    const fillPrice = order.price > 0 ? order.price : params.markPrice;
    const notional = fillPrice * (order.executedQty || qty);
    return {
      orderId: String(order.orderId),
      status: "FILLED",
      fillPrice,
      quantity: order.executedQty || qty,
      feesUsdt: Number((notional * 0.0004).toFixed(4)),
      isPaper: false,
    };
  }

  async closeMarket(params: {
    symbol: string;
    side: "BUY" | "SELL";
    quantity: number;
    markPrice: number;
  }): Promise<ExecutionFill> {
    const qty = roundQty(params.symbol, params.quantity);
    const res = await closeFuturesMarketPosition({
      symbol: params.symbol,
      side: params.side,
      quantity: qty,
      apiKey: this.apiKey,
      apiSecret: this.apiSecret,
      isTestnet: this.isTestnet,
    });
    if (!res.ok) {
      throw new Error(res.text || "Close failed");
    }
    return {
      orderId: String(res.data.orderId || ""),
      status: "FILLED",
      fillPrice: params.markPrice,
      quantity: qty,
      feesUsdt: 0,
      isPaper: false,
    };
  }

  async placeProtection(symbol: string, side: "BUY" | "SELL", sl: number, tp: number) {
    return placeFuturesProtectiveOrders({
      symbol,
      side,
      stopLossPrice: sl,
      takeProfitPrice: tp,
      apiKey: this.apiKey,
      apiSecret: this.apiSecret,
      isTestnet: this.isTestnet,
    });
  }
}
