export function classifyVeto(textEn: string, textRu: string) {
  const t = `${textEn} ${textRu}`.toLowerCase();
  if (t.includes("not enough market data") || t.includes("недостаточно рыночных")) return "NO_DATA";
  if (t.includes("no trend pullback") || t.includes("нет сетапа")) return "NO_SETUP";
  if (t.includes("confluence") || t.includes("класс")) return "LOW_CONFLUENCE";
  if (t.includes("volatility") || t.includes("волатил") || t.includes("ranging") || t.includes("режим")) return "REGIME";
  if (t.includes("too close") || t.includes("нет места") || t.includes("no room")) return "NO_ROOM_FOR_TP";
  if (t.includes("risk/reward")) return "LOW_RR";
  if (t.includes("altcoin") || t.includes("альтам") || t.includes("альту")) return "BTC_BLOCKS_ALT_LONG";
  return "OTHER";
}
import { analyzeMarketStructure } from "../intelligence/MarketStructureEngine.js";
import { analyzeSupportResistance } from "../intelligence/SupportResistanceEngine.js";
import { buildTradePlan } from "../intelligence/TradePlanEngine.js";
import { tradeAllowed } from "../intelligence/NoTradeEngine.js";
import { INTEL } from "../intelligence/config.js";
import type { IntelligenceDecision } from "../intelligence/types.js";
import type { MarketSnapshot, StrategySignal } from "../types.js";
import type { BinanceCandle } from "../../binance.js";

export function vetoClassList(vetoes: { textEn: string; textRu: string }[]) {
  return vetoes.map((v) => classifyVeto(v.textEn, v.textRu));
}

export function isRegimeOnlyBlock(vetoes: { textEn: string; textRu: string }[]) {
  const classes = vetoClassList(vetoes);
  if (!classes.length) return false;
  return classes.includes("REGIME") && classes.every((c) => c === "REGIME");
}

/** Would have been a live TRADE if regime.noNewTrades were ignored. Does not change Intelligence. */
export function wouldTradeWithoutRegime(intel: IntelligenceDecision) {
  return Boolean(intel.setup && tradeAllowed(intel.confluence.grade) && isRegimeOnlyBlock(intel.vetoes));
}

export function shadowSignalFromIntel(params: {
  symbol: string;
  intel: IntelligenceDecision;
  h1: MarketSnapshot;
  m5: MarketSnapshot;
  candles: {
    d1?: BinanceCandle[];
    h4?: BinanceCandle[];
    h1?: BinanceCandle[];
  };
}): StrategySignal | null {
  const { intel, h1, m5 } = params;
  if (!intel.setup) return null;
  const structure = analyzeMarketStructure(params.candles.h1 || params.candles.h4);
  const levels = analyzeSupportResistance({
    price: m5.price || h1.price,
    d1: params.candles.d1,
    h4: params.candles.h4,
    h1: params.candles.h1,
    atr: m5.atr || h1.atr || 0,
  });
  const plan = buildTradePlan({
    symbol: params.symbol,
    direction: intel.setup.direction,
    setup: intel.setup,
    score: intel.confluence.total,
    grade: intel.confluence.grade,
    h1,
    m5,
    structure,
    levels,
  });
  if (!plan || plan.riskReward < INTEL.minRr) return null;
  const grade = plan.grade === "A+" || intel.confluence.grade === "A+" ? "A+" : "A";
  return {
    symbol: plan.symbol,
    direction: plan.direction,
    confidence: intel.confluence.total,
    qualityScore: intel.confluence.total,
    confluenceScore: intel.confluence.total,
    setupGrade: grade,
    setupType: plan.setupType,
    entryPrice: plan.entry,
    stopLoss: plan.stopLoss,
    takeProfit: plan.takeProfit2,
    takeProfit1: plan.takeProfit1,
    takeProfit2: plan.takeProfit2,
    takeProfit3: plan.takeProfit3,
    invalidation: plan.invalidation,
    riskReward: plan.riskReward,
    reasoning: intel.confluence.lines.map((l) => `${l.key}:${l.points}/${l.max}`).join("; "),
    strategy: plan.setupType,
    scoreLines: intel.confluence.lines,
  };
}
