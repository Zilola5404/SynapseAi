import type { MarketSnapshot } from "../types.js";
import type { MultiTimeframeAnalysis } from "./types.js";

/**
 * Top-down: 1D context, 4H main trend, 1H structure, 15m confirmation, 5m entry only.
 * 5m is never used to decide the global trend.
 */
export function analyzeMultiTimeframe(snaps: {
  d1?: MarketSnapshot | null;
  h4?: MarketSnapshot | null;
  h1: MarketSnapshot | null;
  m15: MarketSnapshot | null;
  m5: MarketSnapshot | null;
}): MultiTimeframeAnalysis {
  const daily = snaps.d1 || null;
  const h4 = snaps.h4 || null;
  const h1 = snaps.h1;
  const m15 = snaps.m15;
  const m5 = snaps.m5;
  const mainTrend = h4?.trend || h1?.trend || "NEUTRAL";
  const confirmOk =
    Boolean(m15) &&
    ((mainTrend === "BULLISH" && (m15!.trend === "BULLISH" || m15!.ema20 > m15!.ema50)) ||
      (mainTrend === "BEARISH" && (m15!.trend === "BEARISH" || m15!.ema20 < m15!.ema50)));
  const reasons = [
    {
      textRu: `Главный тренд (4H/1H): ${mainTrend === "BULLISH" ? "восходящий" : mainTrend === "BEARISH" ? "нисходящий" : "нет"}`,
      textEn: `Main trend (4H/1H): ${mainTrend.toLowerCase()}`,
      ok: mainTrend !== "NEUTRAL",
    },
    {
      textRu: confirmOk ? "15m подтверждает направление" : "15m не подтверждает направление",
      textEn: confirmOk ? "15m confirms direction" : "15m does not confirm direction",
      ok: confirmOk,
    },
    {
      textRu: "5m используется только для точки входа, не для тренда",
      textEn: "5m is used for entry timing only, not for trend",
      ok: true,
    },
  ];
  return { daily, h4, h1, m15, m5, mainTrend, confirmOk, reasons };
}
