import { INTEL } from "./config.js";
import type { ConfluenceResult, Reason, RegimeResult, SetupCandidate } from "./types.js";
import type { TradeSide } from "../types.js";

export function collectNoTradeReasons(params: {
  direction: TradeSide | null;
  setup: SetupCandidate | null;
  confluence: ConfluenceResult;
  regime: RegimeResult;
  extra: Reason[];
  blockAltLong?: boolean;
}): Reason[] {
  const vetoes: Reason[] = [...params.extra];
  if (params.regime.noNewTrades) {
    vetoes.push(...params.regime.reasons.filter((r) => !r.ok));
  }
  if (params.blockAltLong && params.direction === "LONG") {
    vetoes.push({
      textRu: "Общий рынок слабый (BTC) — LONG по альту не открываем",
      textEn: "Broad market is weak (BTC) — altcoin LONG is blocked",
      ok: false,
    });
  }
  if (!params.setup || !params.direction) {
    vetoes.push({
      textRu: "Нет сетапа Trend Pullback или Breakout+Retest",
      textEn: "No Trend Pullback or Breakout+Retest setup",
      ok: false,
    });
  }
  if (params.confluence.grade === "NO_TRADE" || params.confluence.grade === "B") {
    vetoes.push({
      textRu: `Confluence ${params.confluence.total}/${params.confluence.max} — класс ${params.confluence.grade}, сделка не открывается`,
      textEn: `Confluence ${params.confluence.total}/${params.confluence.max} — grade ${params.confluence.grade}, no trade`,
      ok: false,
    });
  }
  const seen = new Set<string>();
  return vetoes.filter((v) => {
    const k = v.textRu;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function autoAllowed(grade: string) {
  return grade === "A+";
}

export function tradeAllowed(grade: string) {
  return grade === "A+" || grade === "A";
}

void INTEL;
