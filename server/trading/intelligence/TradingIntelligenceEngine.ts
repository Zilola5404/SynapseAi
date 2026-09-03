import type { BinanceCandle } from "../../binance.js";
import type { MarketSnapshot, StrategySignal } from "../types.js";
import type { SignalDecision } from "../signal/SignalEngine.js";
import { INTEL } from "./config.js";
import { analyzeMarketContext } from "./MarketContextEngine.js";
import { analyzeRegime } from "./MarketRegimeEngine.js";
import { analyzeMultiTimeframe } from "./MultiTimeframeEngine.js";
import { analyzeMarketStructure } from "./MarketStructureEngine.js";
import { analyzeSupportResistance } from "./SupportResistanceEngine.js";
import { analyzeLiquidity } from "./LiquidityEngine.js";
import { analyzeVolume } from "./VolumeEngine.js";
import { detectSetup } from "./SetupEngine.js";
import { scoreConfluence } from "./ConfluenceEngine.js";
import { collectNoTradeReasons, tradeAllowed } from "./NoTradeEngine.js";
import { buildTradePlan } from "./TradePlanEngine.js";
import type { IntelligenceDecision, Reason } from "./types.js";
import type { MarketSnapshot as Snap } from "../types.js";
import { logger } from "../../logger.js";

export type IntelligenceInput = {
  symbol: string;
  snapshots: {
    d1?: MarketSnapshot | null;
    h4?: MarketSnapshot | null;
    h1: MarketSnapshot | null;
    m15: MarketSnapshot | null;
    m5: MarketSnapshot | null;
  };
  candles?: {
    d1?: BinanceCandle[];
    h4?: BinanceCandle[];
    h1?: BinanceCandle[];
    m15?: BinanceCandle[];
    m5?: BinanceCandle[];
  };
  btc?: {
    d1?: MarketSnapshot | null;
    h4?: MarketSnapshot | null;
    h1?: MarketSnapshot | null;
  };
};

function emptySnap(): Snap {
  return {
    symbol: "BTCUSDT",
    price: 0,
    trend: "NEUTRAL",
    rsi: 50,
    ema20: 0,
    ema50: 0,
    ema200: 0,
    macdSignal: "NEUTRAL",
    atr: 0,
    volatility: "MEDIUM",
    timeframe: "1H",
  };
}

export function evaluateIntelligence(input: IntelligenceInput): IntelligenceDecision {
  const { snapshots, candles, symbol } = input;
  const h1 = snapshots.h1;
  const m15 = snapshots.m15;
  const m5 = snapshots.m5;
  const btcSnaps =
    input.btc ||
    (symbol === "BTCUSDT" ? { d1: snapshots.d1, h4: snapshots.h4, h1: snapshots.h1 } : undefined);
  const context = analyzeMarketContext(btcSnaps || {});
  const mtf = analyzeMultiTimeframe(snapshots);
  const structure = analyzeMarketStructure(candles?.h1 || candles?.h4);
  const regime = analyzeRegime({
    h1: h1 || m5 || emptySnap(),
    h4: snapshots.h4,
    m5,
    candles: candles?.h4 || candles?.h1,
  });
  const levels = analyzeSupportResistance({
    price: m5?.price || h1?.price || 0,
    d1: candles?.d1,
    h4: candles?.h4,
    h1: candles?.h1,
    atr: m5?.atr || h1?.atr || 0,
  });
  const liquidity = analyzeLiquidity({
    candles: candles?.h1 || candles?.h4,
    atr: h1?.atr || m5?.atr || 0,
    structure,
  });
  const volume = analyzeVolume(m5?.relativeVolume || h1?.relativeVolume, m5?.volume, m5?.avgVolume);

  const extra: Reason[] = [];
  if (!h1 || !m15 || !m5) {
    extra.push({ textRu: "Недостаточно рыночных данных", textEn: "Not enough market data", ok: false });
  }
  const alt = symbol !== "BTCUSDT";
  if (alt && context.blockAltLong) {
    extra.push({
      textRu: "BTC падает при высокой волатильности — LONG по альтам запрещён",
      textEn: "BTC is bearish with high volatility — altcoin LONGs are blocked",
      ok: false,
    });
  }

  const setup = h1 && m15 && m5 ? detectSetup({ mtf, structure, levels, regime }) : null;
  const direction = setup?.direction || null;
  const contextForScore =
    symbol === "BTCUSDT" ? analyzeMarketContext({ d1: snapshots.d1, h4: snapshots.h4, h1: snapshots.h1 }) : context;

  let plan = null;
  let confluence = scoreConfluence({
    direction: direction || "LONG",
    context: contextForScore,
    mtf,
    structure,
    atLevel: false,
    liquidity,
    volume,
    riskReward: 0,
  });

  if (setup && direction && h1 && m5) {
    const roomOk = direction === "LONG" ? levels.roomForLong : levels.roomForShort;
    if (!roomOk) {
      extra.push({
        textRu:
          direction === "LONG"
            ? "Цена слишком близко к сопротивлению — нет места для TP >= 2R"
            : "Цена слишком близко к поддержке — нет места для TP >= 2R",
        textEn:
          direction === "LONG"
            ? "Price is too close to resistance — no room for TP >= 2R"
            : "Price is too close to support — no room for TP >= 2R",
        ok: false,
      });
    }
    const drafted = buildTradePlan({
      symbol,
      direction,
      setup,
      score: 0,
      grade: "NO_TRADE",
      h1,
      m5,
      structure,
      levels,
    });
    plan = drafted;
    if (drafted && drafted.riskReward < INTEL.minRr) {
      extra.push({
        textRu: `Risk/Reward ${drafted.riskReward} ниже минимума ${INTEL.minRr}`,
        textEn: `Risk/Reward ${drafted.riskReward} is below ${INTEL.minRr}`,
        ok: false,
      });
    }
    const atLevel =
      roomOk &&
      ((direction === "LONG" && levels.nearestSupport > 0) || (direction === "SHORT" && levels.nearestResistance > 0));
    confluence = scoreConfluence({
      direction,
      context: contextForScore,
      mtf,
      structure,
      atLevel,
      liquidity,
      volume,
      riskReward: drafted?.riskReward || 0,
    });
    if (drafted) {
      drafted.setupScore = confluence.total;
      drafted.grade = confluence.grade;
      plan = drafted;
    }
  }

  const vetoes = collectNoTradeReasons({
    direction,
    setup,
    confluence,
    regime,
    extra,
    blockAltLong: alt && context.blockAltLong,
  });

  const blocked =
    !setup ||
    !plan ||
    !tradeAllowed(confluence.grade) ||
    regime.noNewTrades ||
    extra.some((e) => e.ok === false);

  logger.info(
    {
      symbol,
      marketContext: context.marketMode,
      regime: regime.regime,
      structure: structure.structure,
      setup: setup?.type || "NONE",
      score: confluence.total,
      grade: confluence.grade,
      decision: blocked ? "NO_TRADE" : "TRADE",
      volumeClass: volume.klass,
      volumeConfirms: volume.confirms,
      rr: plan?.riskReward || 0,
    },
    "[INTELLIGENCE]"
  );

  if (blocked) {
    return {
      decision: "NO_TRADE",
      plan: null,
      shadowPlan: plan,
      confluence,
      vetoes: vetoes.length ? vetoes : extra,
      context,
      regime,
      setup,
      structureLabel: structure.structure,
    };
  }

  return {
    decision: "TRADE",
    plan,
    shadowPlan: null,
    confluence,
    vetoes: [],
    context,
    regime,
    setup,
    structureLabel: structure.structure,
  };
}

export function decisionToSignal(result: IntelligenceDecision): SignalDecision {
  const toSignal = (p: NonNullable<IntelligenceDecision["plan"]>): StrategySignal => ({
    symbol: p.symbol,
    direction: p.direction,
    confidence: p.setupScore,
    qualityScore: p.setupScore,
    confluenceScore: p.setupScore,
    setupGrade: p.grade === "A+" ? "A+" : "A",
    setupType: p.setupType,
    entryPrice: p.entry,
    stopLoss: p.stopLoss,
    takeProfit: p.takeProfit2,
    takeProfit1: p.takeProfit1,
    takeProfit2: p.takeProfit2,
    takeProfit3: p.takeProfit3,
    invalidation: p.invalidation,
    riskReward: p.riskReward,
    reasoning: result.confluence.lines.map((l) => `${l.key}:${l.points}/${l.max}`).join("; "),
    strategy: p.setupType,
    scoreLines: result.confluence.lines,
    marketRegime: result.regime.regime,
    structure: result.structureLabel || "",
  });
  if (result.decision !== "TRADE" || !result.plan) {
    return {
      signal: null,
      shadowSignal: result.shadowPlan ? toSignal(result.shadowPlan) : null,
      qualityScore: result.confluence.total,
      vetoes: result.vetoes,
      regime: result.regime.regime,
    };
  }
  const signal = toSignal(result.plan);
  return {
    signal,
    shadowSignal: null,
    qualityScore: result.plan.setupScore,
    vetoes: [],
    regime: result.regime.regime,
  };
}
