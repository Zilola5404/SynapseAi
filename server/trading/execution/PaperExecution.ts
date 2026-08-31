import type { ExecutionProvider, ExecutionFill } from "./ExecutionProvider.js";
import { applyPaperFill } from "./ExecutionProvider.js";

export class PaperExecution implements ExecutionProvider {
  mode = "PAPER" as const;

  async openMarket(params: {
    symbol: string;
    side: "BUY" | "SELL";
    quantity: number;
    markPrice: number;
    clientOrderId: string;
  }): Promise<ExecutionFill> {
    if (!params.markPrice || params.quantity <= 0) {
      return {
        orderId: params.clientOrderId,
        clientOrderId: params.clientOrderId,
        status: "REJECTED",
        fillPrice: 0,
        quantity: 0,
        feesUsdt: 0,
        isPaper: true,
      };
    }
    return applyPaperFill(params.side, params.markPrice, params.quantity, params.clientOrderId);
  }

  async closeMarket(params: {
    symbol: string;
    side: "BUY" | "SELL";
    quantity: number;
    markPrice: number;
    clientOrderId: string;
  }): Promise<ExecutionFill> {
    return this.openMarket(params);
  }

  async cancelAllOrders() {
    return;
  }

  async cancelProtective() {
    return;
  }

  async getBalance() {
    return { equity: 0, available: 0 };
  }

  async getExchangePositions() {
    return [];
  }
}

export const paperExecution = new PaperExecution();
