import type { BinanceCandle } from "../../binance.js";
import { detectLiquiditySweep, equalLevels, findSwings } from "../../market/swings.js";
import type { LiquidityResult, StructureResult } from "./types.js";

/**
 * Liquidity sweep is NOT a trade signal by itself.
 * Points are awarded only when sweep is followed by BOS or CHoCH.
 */
export function analyzeLiquidity(params: {
  candles?: BinanceCandle[];
  atr: number;
  structure: StructureResult;
}): LiquidityResult {
  const candles = params.candles || [];
  const swings = findSwings(candles);
  const highs = swings.filter((s) => s.kind === "H").map((s) => s.price);
  const lows = swings.filter((s) => s.kind === "L").map((s) => s.price);
  const equalHighs = equalLevels(highs).length > 0;
  const equalLows = equalLevels(lows).length > 0;
  const previousHigh = highs.at(-1) || 0;
  const previousLow = lows.at(-1) || 0;
  const sweep = detectLiquiditySweep(candles, swings, params.atr);
  const confirmed =
    (sweep === "HIGH" && (params.structure.choch === "BEARISH" || params.structure.bos === "BEARISH")) ||
    (sweep === "LOW" && (params.structure.choch === "BULLISH" || params.structure.bos === "BULLISH"));
  const score = confirmed ? 2 : sweep !== "NONE" ? 0 : 0;
  const reasons = [];
  if (sweep !== "NONE") {
    reasons.push({
      textRu:
        sweep === "HIGH"
          ? "Возможный liquidity sweep над предыдущим максимумом"
          : "Возможный liquidity sweep под предыдущим минимумом",
      textEn: sweep === "HIGH" ? "Potential liquidity sweep of previous high" : "Potential liquidity sweep of previous low",
      ok: confirmed,
    });
    if (!confirmed) {
      reasons.push({
        textRu: "Sweep без BOS/CHoCH — это не сигнал входа",
        textEn: "Sweep without BOS/CHoCH is not an entry signal",
        ok: false,
      });
    }
  } else {
    reasons.push({
      textRu: "Liquidity sweep не обнаружен — баллы за ликвидность не начисляются",
      textEn: "No liquidity sweep detected — no liquidity points awarded",
      ok: false,
    });
  }
  if (equalHighs) reasons.push({ textRu: "Есть Equal Highs", textEn: "Equal highs present", ok: true });
  if (equalLows) reasons.push({ textRu: "Есть Equal Lows", textEn: "Equal lows present", ok: true });
  return { equalHighs, equalLows, previousHigh, previousLow, sweep, confirmed, score, reasons };
}
