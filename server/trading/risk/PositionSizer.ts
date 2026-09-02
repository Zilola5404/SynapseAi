export type PositionSizeMode = "AUTO" | "CAPPED" | "FIXED";

export type SizeCapReason = "none" | "max_margin" | "max_notional" | "fixed";

export type SizeBreakdown = {
  mode: PositionSizeMode;
  equity: number;
  riskPct: number;
  riskAmount: number;
  stopDistPct: number;
  calculatedSizeUsdt: number;
  maxMarginUsdt: number;
  maxNotionalUsdt: number;
  fixedNotionalUsdt: number;
  cappedBy: SizeCapReason;
  quantity: number;
  sizeUsdt: number;
  marginUsdt: number;
  leverage: number;
  maxLossUsdt: number;
};

export function sizePosition(params: {
  equity: number;
  riskPerTradePct: number;
  entry: number;
  stopLoss: number;
  maxLeverage: number;
}): { quantity: number; sizeUsdt: number; marginUsdt: number; leverage: number } {
  const planned = planPositionSize({
    ...params,
    maxPositionSizePct: 100,
    mode: "AUTO",
    maxNotionalUsdt: 0,
    fixedNotionalUsdt: 0,
  });
  return {
    quantity: planned.quantity,
    sizeUsdt: planned.sizeUsdt,
    marginUsdt: planned.marginUsdt,
    leverage: planned.leverage,
  };
}

export function planPositionSize(params: {
  equity: number;
  riskPerTradePct: number;
  entry: number;
  stopLoss: number;
  maxLeverage: number;
  maxPositionSizePct?: number;
  mode?: PositionSizeMode;
  maxNotionalUsdt?: number;
  fixedNotionalUsdt?: number;
}): SizeBreakdown {
  const leverage = Math.max(1, Math.min(params.maxLeverage || 1, 3));
  const stopDistPct = params.entry > 0 ? (Math.abs(params.entry - params.stopLoss) / params.entry) * 100 : 0;
  const riskAmount = params.equity * (params.riskPerTradePct / 100);
  const stopDist = stopDistPct / 100;
  const calculatedSizeUsdt = stopDist > 0 ? riskAmount / stopDist : 0;
  const maxMarginUsdt = params.equity * ((params.maxPositionSizePct ?? 10) / 100);
  const maxNotionalUsdt = params.maxNotionalUsdt ?? 0;
  const fixedNotionalUsdt = params.fixedNotionalUsdt ?? 0;
  const mode: PositionSizeMode = params.mode === "FIXED" || params.mode === "CAPPED" ? params.mode : "AUTO";

  let sizeUsdt = calculatedSizeUsdt;
  let cappedBy: SizeCapReason = "none";

  if (mode === "FIXED" && fixedNotionalUsdt > 0) {
    sizeUsdt = fixedNotionalUsdt;
    cappedBy = "fixed";
  } else {
    if (leverage > 0 && sizeUsdt / leverage > maxMarginUsdt && maxMarginUsdt > 0) {
      sizeUsdt = maxMarginUsdt * leverage;
      cappedBy = "max_margin";
    }
    if ((mode === "CAPPED" || mode === "AUTO") && maxNotionalUsdt > 0 && sizeUsdt > maxNotionalUsdt) {
      sizeUsdt = maxNotionalUsdt;
      cappedBy = "max_notional";
    }
  }

  if (params.entry <= 0 || (stopDist <= 0 && mode !== "FIXED")) {
    return {
      mode,
      equity: params.equity,
      riskPct: params.riskPerTradePct,
      riskAmount,
      stopDistPct,
      calculatedSizeUsdt: 0,
      maxMarginUsdt,
      maxNotionalUsdt,
      fixedNotionalUsdt,
      cappedBy: "none",
      quantity: 0,
      sizeUsdt: 0,
      marginUsdt: 0,
      leverage,
      maxLossUsdt: 0,
    };
  }

  const marginUsdt = sizeUsdt / leverage;
  const quantity = sizeUsdt / params.entry;
  const maxLossUsdt = sizeUsdt * (stopDist || 0);

  return {
    mode,
    equity: params.equity,
    riskPct: params.riskPerTradePct,
    riskAmount: Number(riskAmount.toFixed(2)),
    stopDistPct: Number(stopDistPct.toFixed(3)),
    calculatedSizeUsdt: Number(calculatedSizeUsdt.toFixed(2)),
    maxMarginUsdt: Number(maxMarginUsdt.toFixed(2)),
    maxNotionalUsdt,
    fixedNotionalUsdt,
    cappedBy,
    quantity: Number(quantity.toFixed(6)),
    sizeUsdt: Number(sizeUsdt.toFixed(2)),
    marginUsdt: Number(marginUsdt.toFixed(2)),
    leverage,
    maxLossUsdt: Number(maxLossUsdt.toFixed(2)),
  };
}
