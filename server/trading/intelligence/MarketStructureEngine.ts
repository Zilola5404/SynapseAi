import type { BinanceCandle } from "../../binance.js";
import { classifyStructure, detectBosChoch, findSwings, nearestLevels } from "../../market/swings.js";
import type { StructureResult, StructureState } from "./types.js";

export function analyzeMarketStructure(candles: BinanceCandle[] | undefined): StructureResult {
  const empty: StructureResult = {
    structure: "RANGE",
    lastSwingHigh: 0,
    lastSwingLow: 0,
    bos: "NONE",
    choch: "NONE",
    reasons: [{ textRu: "Недостаточно свечей для структуры", textEn: "Not enough candles for structure", ok: false }],
  };
  if (!candles || candles.length < 30) return empty;
  const swings = findSwings(candles);
  const raw = classifyStructure(swings);
  const highs = swings.filter((s) => s.kind === "H").slice(-3);
  const lows = swings.filter((s) => s.kind === "L").slice(-3);
  let structure: StructureState = raw;
  if (highs.length >= 2 && lows.length >= 2) {
    const hh = highs[highs.length - 1].price > highs[highs.length - 2].price;
    const hl = lows[lows.length - 1].price > lows[lows.length - 2].price;
    const ll = lows[lows.length - 1].price < lows[lows.length - 2].price;
    const lh = highs[highs.length - 1].price < highs[highs.length - 2].price;
    if ((hh && ll) || (lh && hl)) structure = "TRANSITION";
    else if (hh && hl) structure = "BULLISH";
    else if (ll && lh) structure = "BEARISH";
    else structure = "RANGE";
  }
  const levels = nearestLevels(candles[candles.length - 1].close, swings);
  const { bos, choch } = detectBosChoch(candles, swings);
  const reasons = [
    {
      textRu:
        structure === "BULLISH"
          ? "Структура: Higher High / Higher Low"
          : structure === "BEARISH"
            ? "Структура: Lower High / Lower Low"
            : structure === "TRANSITION"
              ? "Структура: переход (смешанные swing)"
              : "Структура: боковик",
      textEn: `Structure: ${structure}`,
      ok: structure === "BULLISH" || structure === "BEARISH",
    },
  ];
  if (bos !== "NONE") {
    reasons.push({
      textRu: bos === "BULLISH" ? "Break of Structure вверх" : "Break of Structure вниз",
      textEn: `BOS ${bos.toLowerCase()}`,
      ok: true,
    });
  }
  if (choch !== "NONE") {
    reasons.push({
      textRu: choch === "BULLISH" ? "Change of Character вверх" : "Change of Character вниз",
      textEn: `CHoCH ${choch.toLowerCase()}`,
      ok: true,
    });
  }
  return {
    structure,
    lastSwingHigh: levels.lastSwingHigh,
    lastSwingLow: levels.lastSwingLow,
    bos,
    choch,
    reasons,
  };
}
