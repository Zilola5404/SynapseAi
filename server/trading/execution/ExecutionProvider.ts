import type { TradingMode } from "../types.js";

export interface ExecutionFill {
  orderId: string;
  status: "FILLED" | "REJECTED";
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
  }): Promise<ExecutionFill>;
  closeMarket(params: {
    symbol: string;
    side: "BUY" | "SELL";
    quantity: number;
    markPrice: number;
  }): Promise<ExecutionFill>;
}

export const TAKER_FEE = 0.0004;
export const SLIPPAGE = 0.0002;

export function applyPaperFill(side: "BUY" | "SELL", mark: number, quantity: number): ExecutionFill {
  const slip = side === "BUY" ? 1 + SLIPPAGE : 1 - SLIPPAGE;
  const fillPrice = mark * slip;
  const notional = fillPrice * quantity;
  const feesUsdt = notional * TAKER_FEE;
  return {
    orderId: `PAPER_${Date.now()}`,
    status: "FILLED",
    fillPrice: Number(fillPrice.toFixed(6)),
    quantity,
    feesUsdt: Number(feesUsdt.toFixed(4)),
    isPaper: true,
  };
}
