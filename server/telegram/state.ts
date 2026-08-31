import type { StrategySignal } from "../trading/types.js";

export const pendingSignals = new Map<string, StrategySignal>();
export const keySessions = new Map<string, { step: "api_key" | "api_secret"; apiKey?: string }>();
