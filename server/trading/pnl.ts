export type ClosePnl = {
  grossPnl: number;
  entryFee: number;
  exitFee: number;
  totalFees: number;
  /** Futures funding is not applied yet. Always 0 until a funding worker exists. */
  fundingUsdt: number;
  netPnl: number;
};

export function computeTradePnl(params: {
  side: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  entryFeeUsdt?: number;
  exitFeeUsdt?: number;
  fundingUsdt?: number;
}): ClosePnl {
  const isLong = params.side === "LONG" || params.side === "BUY";
  const diff = isLong ? params.exitPrice - params.entryPrice : params.entryPrice - params.exitPrice;
  const grossPnl = params.quantity * diff;
  const entryFee = Math.max(0, params.entryFeeUsdt || 0);
  const exitFee = Math.max(0, params.exitFeeUsdt || 0);
  const funding = Math.max(0, params.fundingUsdt || 0);
  const totalFees = entryFee + exitFee;
  return {
    grossPnl: Number(grossPnl.toFixed(6)),
    entryFee: Number(entryFee.toFixed(6)),
    exitFee: Number(exitFee.toFixed(6)),
    totalFees: Number(totalFees.toFixed(6)),
    fundingUsdt: Number(funding.toFixed(6)),
    netPnl: Number((grossPnl - totalFees - funding).toFixed(6)),
  };
}

/** History row already exists → skip. CLOSED without history must still finalize (recovery). */
export function canRunFinalize(hasHistory: boolean) {
  return !hasHistory;
}

export function roundTripFeeOk(sizeUsdt: number, totalFees: number) {
  if (sizeUsdt <= 0) return false;
  return totalFees >= sizeUsdt * 0.0007;
}
