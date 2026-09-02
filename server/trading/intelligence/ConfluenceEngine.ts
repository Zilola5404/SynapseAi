import { INTEL } from "./config.js";
import { contextPointsFor } from "./MarketContextEngine.js";
import type {
  ConfluenceLine,
  ConfluenceResult,
  LiquidityResult,
  MarketContext,
  MultiTimeframeAnalysis,
  SetupGrade,
  StructureResult,
  VolumeResult,
} from "./types.js";
import type { TradeSide } from "../types.js";

function line(key: string, points: number, max: number, textRu: string, textEn: string): ConfluenceLine {
  const p = Math.max(0, Math.min(max, points));
  return { key, points: p, max, ok: p >= max, textRu, textEn };
}

export function gradeOf(total: number): SetupGrade {
  if (total >= 13) return "A+";
  if (total >= 10) return "A";
  if (total >= 7) return "B";
  return "NO_TRADE";
}

export function scoreConfluence(params: {
  direction: TradeSide;
  context: MarketContext;
  mtf: MultiTimeframeAnalysis;
  structure: StructureResult;
  atLevel: boolean;
  liquidity: LiquidityResult;
  volume: VolumeResult;
  riskReward: number;
}): ConfluenceResult {
  const { direction } = params;
  const btc = contextPointsFor(direction, params.context);
  const h4Trend = params.mtf.h4?.trend || params.mtf.mainTrend;
  const h4Ok = direction === "LONG" ? h4Trend === "BULLISH" : h4Trend === "BEARISH";
  const structOk =
    direction === "LONG"
      ? params.structure.structure === "BULLISH"
      : params.structure.structure === "BEARISH";
  const bosOk =
    direction === "LONG"
      ? params.structure.bos === "BULLISH" || params.structure.choch === "BULLISH"
      : params.structure.bos === "BEARISH" || params.structure.choch === "BEARISH";
  const liqOk = params.liquidity.confirmed;
  const volOk = params.volume.confirms;
  const rrOk = params.riskReward >= INTEL.minRr;

  const lines = [
    line("btc", btc.points, 2, btc.reason.textRu, btc.reason.textEn),
    line(
      "h4",
      h4Ok ? 2 : 0,
      2,
      h4Ok ? "4H тренд совпадает" : "4H тренд не совпадает",
      h4Ok ? "4H trend agrees" : "4H trend does not agree"
    ),
    line(
      "structure",
      structOk ? 2 : 0,
      2,
      structOk ? "1H структура подтверждена" : "1H структура не подтверждена",
      structOk ? "1H structure confirmed" : "1H structure not confirmed"
    ),
    line(
      "level",
      params.atLevel ? 2 : 0,
      2,
      params.atLevel ? "Цена у значимого уровня" : "Нет работы от сильного уровня",
      params.atLevel ? "Price is at a meaningful level" : "Not working from a strong level"
    ),
    line(
      "liquidity",
      liqOk ? 2 : 0,
      2,
      liqOk ? "Liquidity sweep подтверждён BOS/CHoCH" : "Ликвидность не подтверждена (sweep без BOS не считается)",
      liqOk ? "Liquidity sweep confirmed by BOS/CHoCH" : "Liquidity not confirmed (sweep alone is not a signal)"
    ),
    line(
      "bos",
      bosOk ? 2 : 0,
      2,
      bosOk ? "Есть BOS или CHoCH" : "Нет BOS / CHoCH",
      bosOk ? "BOS or CHoCH present" : "No BOS / CHoCH"
    ),
    line(
      "volume",
      volOk ? 1 : 0,
      1,
      volOk ? params.volume.reasons[0]?.textRu || "Объём подтверждает" : "Объём не подтверждает движение",
      volOk ? params.volume.reasons[0]?.textEn || "Volume confirms" : "Volume does not confirm"
    ),
    line(
      "rr",
      rrOk ? 2 : 0,
      2,
      rrOk ? `Risk/Reward ${params.riskReward.toFixed(1)}` : `Risk/Reward ${params.riskReward.toFixed(1)} ниже ${INTEL.minRr}`,
      rrOk ? `Risk/Reward ${params.riskReward.toFixed(1)}` : `Risk/Reward ${params.riskReward.toFixed(1)} below ${INTEL.minRr}`
    ),
  ];
  const total = lines.reduce((s, l) => s + l.points, 0);
  return { total, max: INTEL.confluenceMax, grade: gradeOf(total), lines };
}
