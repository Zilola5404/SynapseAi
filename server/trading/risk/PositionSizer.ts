export function sizePosition(params: {
  equity: number;
  riskPerTradePct: number;
  entry: number;
  stopLoss: number;
  maxLeverage: number;
}): { quantity: number; sizeUsdt: number; marginUsdt: number; leverage: number } {
  const riskAmount = params.equity * (params.riskPerTradePct / 100);
  const stopDist = Math.abs(params.entry - params.stopLoss) / params.entry;
  if (stopDist <= 0 || params.entry <= 0) {
    return { quantity: 0, sizeUsdt: 0, marginUsdt: 0, leverage: 1 };
  }
  const sizeUsdt = riskAmount / stopDist;
  const leverage = Math.min(params.maxLeverage, 3);
  const marginUsdt = sizeUsdt / leverage;
  const quantity = sizeUsdt / params.entry;
  return {
    quantity: Number(quantity.toFixed(6)),
    sizeUsdt: Number(sizeUsdt.toFixed(2)),
    marginUsdt: Number(marginUsdt.toFixed(2)),
    leverage,
  };
}
