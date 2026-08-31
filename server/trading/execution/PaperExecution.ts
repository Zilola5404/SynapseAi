import type { ExecutionProvider, ExecutionFill } from "./ExecutionProvider.js";
import { applyPaperFill } from "./ExecutionProvider.js";

export class PaperExecution implements ExecutionProvider {
  mode = "PAPER" as const;

  async openMarket(params: { symbol: string; side: "BUY" | "SELL"; quantity: number; markPrice: number }): Promise<ExecutionFill> {
    if (!params.markPrice || params.quantity <= 0) {
      return { orderId: "", status: "REJECTED", fillPrice: 0, quantity: 0, feesUsdt: 0, isPaper: true };
    }
    return applyPaperFill(params.side, params.markPrice, params.quantity);
  }

  async closeMarket(params: { symbol: string; side: "BUY" | "SELL"; quantity: number; markPrice: number }): Promise<ExecutionFill> {
    return this.openMarket(params);
  }
}

export const paperExecution = new PaperExecution();
