import { analyzeSignal } from "../signal/SignalEngine.js";
import type { MarketSnapshot, StrategySignal } from "../types.js";
import type { SignalDecision } from "../signal/SignalEngine.js";

export type { SignalDecision };

export class StrategyEngine {
  analyze(h1: MarketSnapshot, m15: MarketSnapshot, m5: MarketSnapshot): SignalDecision {
    return analyzeSignal(h1, m15, m5);
  }

  evaluate(h1: MarketSnapshot, m15: MarketSnapshot, m5: MarketSnapshot): StrategySignal | null {
    return this.analyze(h1, m15, m5).signal;
  }
}

export const strategyEngine = new StrategyEngine();
