import type { MarketSnapshot, StrategySignal, TradeSide } from "../types.js";
import { riskReward } from "../../market/TechnicalAnalysis.js";
import { MIN_SETUP_SCORE, scoreSetup } from "./score.js";

export type Veto = { textRu: string; textEn: string };

export type SignalDecision = {
  signal: StrategySignal | null;
  qualityScore: number;
  vetoes: Veto[];
  regime: string;
};

export function trendMomentumLongOk(h1: MarketSnapshot, m5: MarketSnapshot): boolean {
  return (
    h1.ema20 > h1.ema50 &&
    h1.price > h1.ema200 &&
    m5.rsi > 45 &&
    m5.rsi < 70 &&
    (m5.macdSignal === "BULLISH_CROSS" || h1.trend === "BULLISH") &&
    m5.volatility !== "EXTREME"
  );
}

export function trendMomentumShortOk(h1: MarketSnapshot, m5: MarketSnapshot): boolean {
  return (
    h1.ema20 < h1.ema50 &&
    h1.price < h1.ema200 &&
    m5.rsi < 55 &&
    m5.rsi > 30 &&
    (m5.macdSignal === "BEARISH_CROSS" || h1.trend === "BEARISH") &&
    m5.volatility !== "EXTREME"
  );
}

export function planStops(direction: TradeSide, h1: MarketSnapshot, m5: MarketSnapshot) {
  const entry = m5.price;
  const atr = m5.atr || h1.price * 0.01;
  if (direction === "LONG") {
    let sl = entry - atr * 1.5;
    if (h1.lastSwingLow && h1.lastSwingLow < entry) {
      sl = Math.min(sl, h1.lastSwingLow - atr * 0.1);
    }
    let tp = entry + atr * 3;
    let blockedByLevel = false;
    if (h1.nearestResistance && h1.nearestResistance > entry) {
      const beforeRes = h1.nearestResistance - atr * 0.15;
      if (beforeRes <= entry) blockedByLevel = true;
      else tp = Math.min(tp, beforeRes);
    }
    const rr = riskReward(entry, sl, tp);
    if (rr < 1.5 && h1.nearestResistance) blockedByLevel = true;
    return { entry, sl: Number(sl.toFixed(4)), tp: Number(tp.toFixed(4)), rr, blockedByLevel };
  }
  let sl = entry + atr * 1.5;
  if (h1.lastSwingHigh && h1.lastSwingHigh > entry) {
    sl = Math.max(sl, h1.lastSwingHigh + atr * 0.1);
  }
  let tp = entry - atr * 3;
  let blockedByLevel = false;
  if (h1.nearestSupport && h1.nearestSupport < entry) {
    const beforeSup = h1.nearestSupport + atr * 0.15;
    if (beforeSup >= entry) blockedByLevel = true;
    else tp = Math.max(tp, beforeSup);
  }
  const rr = riskReward(entry, sl, tp);
  if (rr < 1.5 && h1.nearestSupport) blockedByLevel = true;
  return { entry, sl: Number(sl.toFixed(4)), tp: Number(tp.toFixed(4)), rr, blockedByLevel };
}

function collectVetoes(direction: TradeSide | null, h1: MarketSnapshot, m15: MarketSnapshot, m5: MarketSnapshot): Veto[] {
  const vetoes: Veto[] = [];
  const regime = m5.regime || h1.regime;
  if (m5.volatility === "EXTREME" || regime === "HIGH_VOLATILITY") {
    vetoes.push({
      textRu: "Волатильность слишком высокая — сделки не открываются",
      textEn: "Volatility is too high — no new trades",
    });
  }
  if (!direction) {
    vetoes.push({
      textRu: "Тренд и momentum не совпали на 1H и 5M",
      textEn: "Trend and momentum do not align on 1H and 5M",
    });
    return vetoes;
  }
  if (direction === "LONG" && h1.structure === "BEARISH") {
    vetoes.push({
      textRu: "Структура рынка медвежья (LH/LL) — LONG не рекомендуется",
      textEn: "Bearish market structure (LH/LL) — LONG is not recommended",
    });
  }
  if (direction === "SHORT" && h1.structure === "BULLISH") {
    vetoes.push({
      textRu: "Структура рынка бычья (HH/HL) — SHORT не рекомендуется",
      textEn: "Bullish market structure (HH/HL) — SHORT is not recommended",
    });
  }
  const stops = planStops(direction, h1, m5);
  if (stops.blockedByLevel) {
    vetoes.push({
      textRu:
        direction === "LONG"
          ? "Take Profit упирается в ближайшее сопротивление"
          : "Take Profit упирается в ближайшую поддержку",
      textEn:
        direction === "LONG"
          ? "Take Profit runs into nearby resistance"
          : "Take Profit runs into nearby support",
    });
  }
  if (stops.rr < 1.5) {
    vetoes.push({
      textRu: `Соотношение риск/прибыль ${stops.rr} ниже 1.5`,
      textEn: `Risk/Reward ${stops.rr} is below 1.5`,
    });
  }
  void m15;
  return vetoes;
}

export function analyzeSignal(h1: MarketSnapshot, m15: MarketSnapshot, m5: MarketSnapshot): SignalDecision {
  const regime = m5.regime || h1.regime || "RANGING";
  const longOk = trendMomentumLongOk(h1, m5);
  const shortOk = trendMomentumShortOk(h1, m5);
  const direction: TradeSide | null = longOk ? "LONG" : shortOk ? "SHORT" : null;
  const vetoes = collectVetoes(direction, h1, m15, m5);

  if (!direction) {
    return { signal: null, qualityScore: 0, vetoes, regime };
  }

  const stops = planStops(direction, h1, m5);
  const scored = scoreSetup({
    direction,
    h1,
    m15,
    m5,
    riskReward: stops.rr,
    roomToTarget: !stops.blockedByLevel,
  });

  if (scored.total < MIN_SETUP_SCORE) {
    vetoes.push({
      textRu: `Качество сетапа ${scored.total}/100 ниже порога ${MIN_SETUP_SCORE}`,
      textEn: `Setup quality ${scored.total}/100 is below ${MIN_SETUP_SCORE}`,
    });
  }

  const hardBlock = vetoes.some((v) =>
    /волатильность слишком|упирается|ниже 1\.5|медвежья|бычья/i.test(v.textRu)
  );
  if (hardBlock || scored.total < MIN_SETUP_SCORE) {
    return { signal: null, qualityScore: scored.total, vetoes, regime };
  }

  const signal: StrategySignal = {
    symbol: h1.symbol,
    direction,
    confidence: scored.total,
    qualityScore: scored.total,
    entryPrice: stops.entry,
    stopLoss: stops.sl,
    takeProfit: stops.tp,
    riskReward: stops.rr,
    reasoning: scored.lines.map((l) => `${l.key}:${l.points}/${l.max}`).join("; "),
    strategy: "TREND_MOMENTUM",
    scoreLines: scored.lines,
  };
  return { signal, qualityScore: scored.total, vetoes: [], regime };
}
