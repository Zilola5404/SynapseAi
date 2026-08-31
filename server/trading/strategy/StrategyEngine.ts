import { evaluateTrendMomentum } from "./TrendMomentumStrategy.js";
import type { MarketSnapshot, StrategySignal } from "../types.js";

export class StrategyEngine {
  evaluate(h1: MarketSnapshot, m15: MarketSnapshot, m5: MarketSnapshot): StrategySignal | null {
    const signal = evaluateTrendMomentum(h1, m15, m5);
    if (!signal) return null;
    if (signal.riskReward < 1.5) return null;
    if (signal.confidence < 60) return null;
    return signal;
  }
}

export const strategyEngine = new StrategyEngine();
