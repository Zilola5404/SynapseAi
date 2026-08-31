/** Place the new SL first, then cancel the old one — never leave the position naked. */
export function nextTrailingStop(params: {
  side: "LONG" | "SHORT";
  entryPrice: number;
  markPrice: number;
  currentStop: number;
  trailingPct: number;
  activateProfitPct?: number;
}): { nextStop: number } | null {
  const isLong = params.side === "LONG";
  const profitPct = isLong
    ? ((params.markPrice - params.entryPrice) / params.entryPrice) * 100
    : ((params.entryPrice - params.markPrice) / params.entryPrice) * 100;
  if (profitPct <= (params.activateProfitPct ?? 2)) return null;
  const offset = params.markPrice * (params.trailingPct / 100);
  const next = isLong ? params.markPrice - offset : params.markPrice + offset;
  if (isLong && next <= params.currentStop) return null;
  if (!isLong && next >= params.currentStop) return null;
  return { nextStop: next };
}

export const TRAIL_SEQUENCE = ["PLACE_NEW_SL", "CONFIRM_NEW_SL", "CANCEL_OLD_SL"] as const;
