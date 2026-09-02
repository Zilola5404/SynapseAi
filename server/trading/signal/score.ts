import type { MarketSnapshot, ScoreLine, TradeSide } from "../types.js";

export const SCORE_CAPS = {
  trend: 20,
  structure: 15,
  momentum: 15,
  volume: 15,
  higherTf: 10,
  levels: 10,
  volatility: 5,
  liquidity: 5,
  riskReward: 5,
} as const;

export const MIN_SETUP_SCORE = 60;

function line(key: string, points: number, max: number, textRu: string, textEn: string): ScoreLine {
  const p = Math.max(0, Math.min(max, Math.round(points)));
  return { key, points: p, max, ok: p >= max * 0.6, textRu, textEn };
}

export function scoreSetup(params: {
  direction: TradeSide;
  h1: MarketSnapshot;
  m15: MarketSnapshot;
  m5: MarketSnapshot;
  riskReward: number;
  roomToTarget: boolean;
}): { total: number; lines: ScoreLine[] } {
  const long = params.direction === "LONG";
  const { h1, m15, m5 } = params;

  const emaOk = long ? h1.ema20 > h1.ema50 : h1.ema20 < h1.ema50;
  const vs200 = long ? h1.price > h1.ema200 : h1.price < h1.ema200;
  const trendAlign = long ? h1.trend === "BULLISH" : h1.trend === "BEARISH";
  let trendPts = 0;
  if (emaOk) trendPts += 8;
  if (vs200) trendPts += 7;
  if (trendAlign) trendPts += 5;
  const trend = line(
    "trend",
    trendPts,
    SCORE_CAPS.trend,
    trendAlign ? (long ? "Тренд: восходящий" : "Тренд: нисходящий") : "Тренд не подтверждён на 1H",
    trendAlign ? (long ? "Trend: up" : "Trend: down") : "1H trend is not confirmed"
  );

  const structureKind = h1.structure;
  let structurePts = 0;
  let structureRu = "Структура рынка: недостаточно данных (нет серии swing)";
  let structureEn = "Market structure: not enough swing data";
  if (structureKind === "BULLISH") {
    structurePts = long ? 15 : 2;
    structureRu = "Структура: Higher High / Higher Low";
    structureEn = "Structure: Higher High / Higher Low";
  } else if (structureKind === "BEARISH") {
    structurePts = long ? 2 : 15;
    structureRu = "Структура: Lower High / Lower Low";
    structureEn = "Structure: Lower High / Lower Low";
  } else if (structureKind === "RANGE") {
    structurePts = 5;
    structureRu = "Структура: боковик / смешанные swing";
    structureEn = "Structure: range / mixed swings";
  } else if (trendAlign) {
    structurePts = 8;
    structureRu = "Структура по свечам не рассчитана, использован тренд 1H";
    structureEn = "Candle structure not computed; 1H trend used as a proxy";
  }

  const structure = line("structure", structurePts, SCORE_CAPS.structure, structureRu, structureEn);

  const rsiOk = long ? m5.rsi > 45 && m5.rsi < 70 : m5.rsi < 55 && m5.rsi > 30;
  const macdOk = long
    ? m5.macdSignal === "BULLISH_CROSS" || h1.trend === "BULLISH"
    : m5.macdSignal === "BEARISH_CROSS" || h1.trend === "BEARISH";
  let momPts = 0;
  if (rsiOk) momPts += 8;
  if (macdOk) momPts += 7;
  const momentum = line(
    "momentum",
    momPts,
    SCORE_CAPS.momentum,
    rsiOk && macdOk ? "Momentum: покупатели/продавцы подтверждают" : "Momentum слабый или перегрет",
    rsiOk && macdOk ? "Momentum confirms the move" : "Momentum is weak or stretched"
  );

  const rel = m5.relativeVolume;
  let volPts = 0;
  let volRu = "Объём: в этой оценке нет данных — не заявляется как подтверждение";
  let volEn = "Volume: no data in this snapshot — not claimed as confirmation";
  if (typeof rel === "number" && rel > 0) {
    if (rel >= 1.2) {
      volPts = 15;
      volRu = `Объём: выше среднего (x${rel.toFixed(2)})`;
      volEn = `Volume: above average (x${rel.toFixed(2)})`;
    } else if (rel >= 0.9) {
      volPts = 9;
      volRu = `Объём: около среднего (x${rel.toFixed(2)})`;
      volEn = `Volume: around average (x${rel.toFixed(2)})`;
    } else {
      volPts = 3;
      volRu = `Объём слабый (x${rel.toFixed(2)}) — не подтверждает импульс`;
      volEn = `Volume is weak (x${rel.toFixed(2)}) — does not confirm`;
    }
  }
  const volume = line("volume", volPts, SCORE_CAPS.volume, volRu, volEn);

  const htfOk = long ? m15.trend === "BULLISH" || m15.ema20 > m15.ema50 : m15.trend === "BEARISH" || m15.ema20 < m15.ema50;
  const higherTf = line(
    "higherTf",
    htfOk ? 10 : 3,
    SCORE_CAPS.higherTf,
    htfOk ? "Старший ТФ (15M) согласован" : "15M не подтверждает направление",
    htfOk ? "Higher TF (15M) agrees" : "15M does not confirm direction"
  );

  let lvlPts = 5;
  let lvlRu = "Уровни: автоматические swing не рассчитаны, Stop/Take по ATR";
  let lvlEn = "Levels: swings not computed, Stop/Take use ATR";
  if (params.roomToTarget) {
    if (long && h1.nearestResistance) {
      lvlPts = 10;
      lvlRu = "До сопротивления есть пространство для цели";
      lvlEn = "There is room to the next resistance";
    } else if (!long && h1.nearestSupport) {
      lvlPts = 10;
      lvlRu = "До поддержки есть пространство для цели";
      lvlEn = "There is room to the next support";
    }
  } else if (h1.nearestResistance || h1.nearestSupport) {
    lvlPts = 2;
    lvlRu = "Цель упирается в ближайший уровень";
    lvlEn = "The target runs into the nearest level";
  }
  const levels = line("levels", lvlPts, SCORE_CAPS.levels, lvlRu, lvlEn);

  let volaPts = 2;
  if (m5.volatility === "MEDIUM") volaPts = 5;
  else if (m5.volatility === "HIGH") volaPts = 3;
  else if (m5.volatility === "LOW") volaPts = 3;
  else if (m5.volatility === "EXTREME") volaPts = 0;
  const volatility = line(
    "volatility",
    volaPts,
    SCORE_CAPS.volatility,
    m5.volatility === "EXTREME" ? "Волатильность экстремальная" : "Волатильность допустимая",
    m5.volatility === "EXTREME" ? "Volatility is extreme" : "Volatility is acceptable"
  );

  const liquidity = line(
    "liquidity",
    0,
    SCORE_CAPS.liquidity,
    "Ликвидность стакана пока не оценивается — баллы не начисляются",
    "Order-book liquidity is not scored yet — no points awarded"
  );

  const rrOk = params.riskReward >= 1.5;
  const riskReward = line(
    "riskReward",
    rrOk ? (params.riskReward >= 2 ? 5 : 4) : 0,
    SCORE_CAPS.riskReward,
    rrOk ? `Risk/Reward ${params.riskReward.toFixed(1)}` : "Risk/Reward ниже 1.5",
    rrOk ? `Risk/Reward ${params.riskReward.toFixed(1)}` : "Risk/Reward below 1.5"
  );

  const lines = [trend, structure, momentum, volume, higherTf, levels, volatility, liquidity, riskReward];
  const total = lines.reduce((s, l) => s + l.points, 0);
  return { total, lines };
}
