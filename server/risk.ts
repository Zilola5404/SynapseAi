/**
 * SERVER-SIDE RISK MANAGEMENT & EMERGENCY SAFEGUARD ENGINE (STAGE 3)
 */

export interface ServerRiskSettings {
  maxDailyLossPct: number; // e.g., 5%
  maxDrawdownPct: number; // e.g., 8%
  maxPositionSizePct: number; // e.g., 10%
  maxLeverage: number; // e.g., 10x
  maxOpenPositions: number; // e.g., 3 positions
  enableTrailingStop: boolean;
  trailingStopPct: number; // e.g., 1.5%
  emergencyKillSwitch: boolean;
}

export interface OrderRiskCheckInput {
  symbol: string;
  side: 'BUY' | 'SELL';
  marginUsdt: number;
  leverage: number;
  accountEquity: number;
  activePositionsCount: number;
  realizedPnL24h: number;
  riskSettings: ServerRiskSettings;
}

export interface OrderRiskCheckResult {
  allowed: boolean;
  reason?: string;
  adjustedMarginUsdt?: number;
  adjustedLeverage?: number;
}

/**
 * Strict Order Validation against Risk Management rules
 */
export function validateOrderRisk(input: OrderRiskCheckInput): OrderRiskCheckResult {
  const {
    marginUsdt,
    leverage,
    accountEquity,
    activePositionsCount,
    realizedPnL24h,
    riskSettings,
  } = input;

  // 1. Emergency Kill Switch Check
  if (riskSettings.emergencyKillSwitch) {
    return {
      allowed: false,
      reason: "АВАРИЙНАЯ ЗАЩИТА (Kill Switch) ВКЛЮЧЕНА! Все новые ордера заблокированы.",
    };
  }

  // 2. Daily Loss Limit Check
  const maxDailyLossUsdt = (accountEquity * (riskSettings.maxDailyLossPct / 100));
  if (realizedPnL24h < 0 && Math.abs(realizedPnL24h) >= maxDailyLossUsdt) {
    return {
      allowed: false,
      reason: `Превышен дневной лимит убытка (-$${Math.abs(realizedPnL24h).toFixed(2)} / макс. -$${maxDailyLossUsdt.toFixed(2)}). Торговля заблокирована на 24ч.`,
    };
  }

  // 3. Max Open Positions Cap
  const maxPositions = riskSettings.maxOpenPositions || 3;
  if (activePositionsCount >= maxPositions) {
    return {
      allowed: false,
      reason: `Достигнут лимит одновременно открытых позиций (${activePositionsCount}/${maxPositions}).`,
    };
  }

  // 4. Max Leverage Check
  if (leverage > riskSettings.maxLeverage) {
    return {
      allowed: false,
      reason: `Плечо ${leverage}x превышает максимальный лимит риска ${riskSettings.maxLeverage}x.`,
    };
  }

  // 5. Max Position Margin Check
  const maxMarginUsdt = accountEquity * (riskSettings.maxPositionSizePct / 100);
  if (marginUsdt > maxMarginUsdt) {
    return {
      allowed: false,
      reason: `Размер маржи $${marginUsdt} превышает разрешенные ${riskSettings.maxPositionSizePct}% от капитала ($${maxMarginUsdt.toFixed(2)}).`,
    };
  }

  return { allowed: true };
}

/**
 * Evaluates active positions for SL/TP, Trailing Stop, and Emergency Liquidations
 */
export function evaluatePositionEmergency(
  position: {
    symbol: string;
    side: 'LONG' | 'SHORT';
    entryPrice: number;
    currentPrice: number;
    sizeUsdt: number;
    marginUsdt: number;
    stopLossPrice: number;
    takeProfitPrice: number;
  },
  riskSettings: ServerRiskSettings
): {
  shouldClose: boolean;
  reason: 'STOP_LOSS' | 'TAKE_PROFIT' | 'LIQUIDATION' | null;
  newStopLossPrice?: number;
} {
  const isLong = position.side === 'LONG';
  const price = position.currentPrice;

  // Check Stop Loss
  if (isLong && price <= position.stopLossPrice) {
    return { shouldClose: true, reason: 'STOP_LOSS' };
  }
  if (!isLong && price >= position.stopLossPrice) {
    return { shouldClose: true, reason: 'STOP_LOSS' };
  }

  // Check Take Profit
  if (isLong && price >= position.takeProfitPrice) {
    return { shouldClose: true, reason: 'TAKE_PROFIT' };
  }
  if (!isLong && price <= position.takeProfitPrice) {
    return { shouldClose: true, reason: 'TAKE_PROFIT' };
  }

  // Check Trailing Stop Update
  if (riskSettings.enableTrailingStop) {
    const priceDiff = isLong ? price - position.entryPrice : position.entryPrice - price;
    const unrealizedPnLPct = ((priceDiff / position.entryPrice) * position.sizeUsdt / position.marginUsdt) * 100;

    if (unrealizedPnLPct > 2.0) {
      const offset = price * (riskSettings.trailingStopPct / 100);
      let updatedSl = position.stopLossPrice;
      if (isLong) {
        const potentialSl = Number((price - offset).toFixed(2));
        if (potentialSl > position.stopLossPrice) updatedSl = potentialSl;
      } else {
        const potentialSl = Number((price + offset).toFixed(2));
        if (potentialSl < position.stopLossPrice) updatedSl = potentialSl;
      }

      if (updatedSl !== position.stopLossPrice) {
        return { shouldClose: false, reason: null, newStopLossPrice: updatedSl };
      }
    }
  }

  return { shouldClose: false, reason: null };
}
