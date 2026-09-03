import { TAKER_FEE, SLIPPAGE } from "../execution/ExecutionProvider.js";

/**
 * Policy floors for expected edge after trading costs.
 * Not fitted on a single live/paper loss or on a backtest search.
 */
export const TRADE_COST_GATE = {
  minNetRr: 1.5,
  minNetToCostRatio: 2,
  fundingHoldHours: 0,
} as const;

export const TRADING_COST_TOO_HIGH = "TRADING_COST_TOO_HIGH";
export const INSUFFICIENT_NET_EDGE = "INSUFFICIENT_NET_EDGE";
export const TP_TOO_CLOSE_TO_COVER_COSTS = "TP_TOO_CLOSE_TO_COVER_COSTS";

export type TradingCostEstimate = {
  entryFee: number;
  estimatedExitFee: number;
  estimatedSlippage: number;
  estimatedFunding: number;
  totalEstimatedCost: number;
};

export type TradeCostEstimate = {
  notional: number;
  initialRisk: number;
  expectedGross: number;
  estimatedEntryFee: number;
  estimatedExitFee: number;
  expectedSlippage: number;
  fundingEstimate: number;
  totalCosts: number;
  expectedNet: number;
  grossRr: number;
  netRr: number;
  pass: boolean;
  reason?: string;
  tradingCost?: TradingCostEstimate;
};

export function estimateTradeCosts(params: {
  entry: number;
  stopLoss: number;
  takeProfit: number;
  quantity: number;
}): TradeCostEstimate {
  const qty = Math.abs(params.quantity);
  const entry = params.entry;
  const notional = entry * qty;
  const initialRisk = qty * Math.abs(entry - params.stopLoss);
  const expectedGross = qty * Math.abs(params.takeProfit - entry);
  const estimatedEntryFee = notional * TAKER_FEE;
  const estimatedExitFee = notional * TAKER_FEE;
  const expectedSlippage = notional * SLIPPAGE * 2;
  const fundingEstimate = 0;
  const totalCosts = estimatedEntryFee + estimatedExitFee + expectedSlippage - fundingEstimate;
  const expectedNet = expectedGross - totalCosts;
  const grossRr = initialRisk > 0 ? expectedGross / initialRisk : 0;
  const netRr = initialRisk > 0 ? expectedNet / initialRisk : 0;
  const netVsCost = expectedNet >= totalCosts * TRADE_COST_GATE.minNetToCostRatio;
  const netRrOk = netRr >= TRADE_COST_GATE.minNetRr;
  const tpCoversCosts = expectedGross > totalCosts;
  const pass = initialRisk > 0 && expectedGross > 0 && tpCoversCosts && netVsCost && netRrOk;
  let reason: string | undefined;
  if (!pass) {
    if (!tpCoversCosts) reason = TP_TOO_CLOSE_TO_COVER_COSTS;
    else reason = INSUFFICIENT_NET_EDGE;
  }
  return {
    notional,
    initialRisk,
    expectedGross,
    estimatedEntryFee,
    estimatedExitFee,
    expectedSlippage,
    fundingEstimate,
    totalCosts,
    expectedNet,
    grossRr,
    netRr,
    pass,
    reason,
    tradingCost: {
      entryFee: estimatedEntryFee,
      estimatedExitFee,
      estimatedSlippage: expectedSlippage,
      estimatedFunding: fundingEstimate,
      totalEstimatedCost: totalCosts,
    },
  };
}

export function isCertificationSignal(signal: { strategy?: string; setupType?: string }) {
  return signal.strategy === "TEST_ORDER" || signal.setupType === "TEST_ORDER";
}
