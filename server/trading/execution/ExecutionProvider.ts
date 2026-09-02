import type { TradingMode } from "../types.js";

export interface ExecutionFill {
  orderId: string;
  clientOrderId?: string;
  status: "FILLED" | "PARTIALLY_FILLED" | "REJECTED" | "FAILED";
  fillPrice: number;
  quantity: number;
  feesUsdt: number;
  isPaper: boolean;
}

export interface ExecutionProvider {
  mode: TradingMode;
  openMarket(params: {
    symbol: string;
    side: "BUY" | "SELL";
    quantity: number;
    markPrice: number;
    clientOrderId: string;
  }): Promise<ExecutionFill>;
  closeMarket(params: {
    symbol: string;
    side: "BUY" | "SELL";
    quantity: number;
    markPrice: number;
    clientOrderId: string;
    reduceOnly?: boolean;
  }): Promise<ExecutionFill>;
  placeProtection?(params: {
    symbol: string;
    entrySide: "BUY" | "SELL";
    stopLoss: number;
    takeProfit: number;
    slClientId: string;
    tpClientId: string;
    quantity: number;
    takeProfits?: { price: number; quantity: number; clientOrderId: string }[];
  }): Promise<{ slOrderId?: string; tpOrderId?: string; tpOrderIds?: string[] }>;
  replaceStop?(params: {
    symbol: string;
    entrySide: "BUY" | "SELL";
    stopLoss: number;
    quantity: number;
    oldSlOrderId?: string | null;
    slClientId: string;
  }): Promise<{ slOrderId: string }>;
  listOpenOrders?(symbol?: string): Promise<{ orderId: string; clientOrderId: string; symbol: string; status: string; type: string }[]>;
  cancelProtective?(params: { symbol: string; slOrderId?: string | null; tpOrderId?: string | null }): Promise<void>;
  cancelAllOrders?(symbol?: string): Promise<void>;
  getBalance?(): Promise<{ equity: number; available: number }>;
  getExchangePositions?(symbol?: string): Promise<{
    symbol: string;
    positionAmt: number;
    entryPrice: number;
    markPrice?: number;
    unRealizedProfit: number;
  }[]>;
  queryOrder?(clientOrderId: string, symbol: string): Promise<ExecutionFill | null>;
}

export const TAKER_FEE = 0.0004;
export const SLIPPAGE = 0.0002;

export function applyPaperFill(side: "BUY" | "SELL", mark: number, quantity: number, clientOrderId?: string): ExecutionFill {
  const slip = side === "BUY" ? 1 + SLIPPAGE : 1 - SLIPPAGE;
  const fillPrice = mark * slip;
  const notional = fillPrice * quantity;
  const feesUsdt = notional * TAKER_FEE;
  return {
    orderId: clientOrderId || `PAPER_${Date.now()}`,
    clientOrderId,
    status: "FILLED",
    fillPrice: Number(fillPrice.toFixed(6)),
    quantity,
    feesUsdt: Number(feesUsdt.toFixed(4)),
    isPaper: true,
  };
}
