import { analyzeSignal } from "../signal/SignalEngine.js";
import type { MarketSnapshot, StrategySignal } from "../types.js";
import type { SignalDecision } from "../signal/SignalEngine.js";
import {
  decisionToSignal,
  evaluateIntelligence,
  type IntelligenceInput,
} from "../intelligence/TradingIntelligenceEngine.js";

export type { SignalDecision };

export class StrategyEngine {
  /** Live path: Trading Intelligence (BTC context, structure, confluence). */
  analyzeBundle(input: IntelligenceInput): SignalDecision {
    return decisionToSignal(evaluateIntelligence(input));
  }

  /**
   * Legacy 3-TF entry. Uses Intelligence with whatever snapshots exist.
   * EMA/RSI/MACD remains a confirmation filter inside SetupEngine, not the sole decision.
   */
  analyze(h1: MarketSnapshot, m15: MarketSnapshot, m5: MarketSnapshot): SignalDecision {
    return this.analyzeBundle({
      symbol: h1.symbol,
      snapshots: { h1, m15, m5 },
    });
  }

  evaluate(h1: MarketSnapshot, m15: MarketSnapshot, m5: MarketSnapshot): StrategySignal | null {
    return this.analyze(h1, m15, m5).signal;
  }

  /** Isolated technical filter — used in tests, not as the live decision. */
  technicalFilter(h1: MarketSnapshot, m15: MarketSnapshot, m5: MarketSnapshot): SignalDecision {
    return analyzeSignal(h1, m15, m5);
  }
}

export const strategyEngine = new StrategyEngine();
