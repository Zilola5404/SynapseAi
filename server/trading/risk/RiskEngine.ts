import type { RiskSettings, User } from "@prisma/client";
import type { RiskDecision, StrategySignal } from "../types.js";
import { planPositionSize, type PositionSizeMode, type SizeBreakdown } from "./PositionSizer.js";
import { estimateTradeCosts, isCertificationSignal, TRADING_COST_TOO_HIGH } from "./tradeCostGate.js";

export type { SizeBreakdown };

function sizeModeOf(risk: RiskSettings): PositionSizeMode {
  const raw = (risk as RiskSettings & { positionSizeMode?: string }).positionSizeMode;
  if (raw === "FIXED" || raw === "CAPPED") return raw;
  return "AUTO";
}

export function evaluateRisk(params: {
  user: User;
  risk: RiskSettings;
  signal: StrategySignal;
  equity: number;
  openCount: number;
  openExposureUsdt: number;
  realizedPnl24h: number;
  source?: "auto" | "manual";
  circuitOpen?: boolean;
  circuitReason?: string;
  skipCostGate?: boolean;
}): RiskDecision {
  const { user, risk, signal, equity, openCount, openExposureUsdt, realizedPnl24h, source = "auto" } = params;

  if (user.accountLocked) {
    return deny("Аккаунт LOCKED после /panic. Нужно /unlock.");
  }
  if (risk.emergencyKillSwitch) {
    return deny("Kill switch активен.");
  }
  if (source !== "manual" && !user.scannerEnabled && !user.autoTradeEnabled) {
    return deny("Автоторговля и сканер выключены.");
  }
  if (user.pauseUntil && user.pauseUntil.getTime() > Date.now()) {
    return deny(`Пауза после серии убытков до ${user.pauseUntil.toISOString()}`);
  }
  if (params.circuitOpen) {
    return deny(`Circuit breaker: ${params.circuitReason || "OPEN"}`);
  }
  if (openCount >= risk.maxOpenPositions) {
    return deny(`Лимит позиций ${openCount}/${risk.maxOpenPositions}`);
  }

  const maxDailyLoss = equity * (risk.maxDailyLossPct / 100);
  if (realizedPnl24h < 0 && Math.abs(realizedPnl24h) >= maxDailyLoss) {
    return deny(`Дневной лимит убытка достигнут (${risk.maxDailyLossPct}%).`, "DAILY_LOSS_LIMIT");
  }

  const peak = peakForTradingVenue({
    tradingMode: user.tradingMode,
    peakEquityUsdt: user.peakEquityUsdt,
    paperBalanceUsdt: user.paperBalanceUsdt,
    equity,
  });
  if (peak > 0 && equity < peak) {
    const dd = ((peak - equity) / peak) * 100;
    if (dd >= risk.maxDrawdownPct) {
      return deny(`Просадка ${dd.toFixed(2)}% >= ${risk.maxDrawdownPct}%`);
    }
  }

  const extra = risk as RiskSettings & { positionSizeMode?: string; maxNotionalUsdt?: number; fixedNotionalUsdt?: number };
  const sized = planPositionSize({
    equity,
    riskPerTradePct: risk.riskPerTradePct,
    entry: signal.entryPrice,
    stopLoss: signal.stopLoss,
    maxLeverage: risk.maxLeverage,
    maxPositionSizePct: risk.maxPositionSizePct,
    mode: sizeModeOf(risk),
    maxNotionalUsdt: extra.maxNotionalUsdt == null ? 500 : extra.maxNotionalUsdt,
    fixedNotionalUsdt: extra.fixedNotionalUsdt == null ? 50 : extra.fixedNotionalUsdt,
  });

  if (sized.quantity <= 0 || sized.marginUsdt < 5) {
    return deny("Размер позиции слишком мал.", "SIZE_INVALID");
  }

  const exposurePct = ((openExposureUsdt + sized.sizeUsdt) / equity) * 100;
  const maxExposure = risk.maxExposurePct || 30;
  if (exposurePct > maxExposure) {
    return deny(`Превышена экспозиция ${exposurePct.toFixed(1)}% / ${maxExposure}%`);
  }

  const skipCost = params.skipCostGate || isCertificationSignal(signal);
  const cost = estimateTradeCosts({
    entry: signal.entryPrice,
    stopLoss: signal.stopLoss,
    takeProfit: signal.takeProfit,
    quantity: sized.quantity,
  });
  if (!skipCost && !cost.pass) {
    return {
      ...deny(
        `${cost.reason || TRADING_COST_TOO_HIGH}: Net RR ${cost.netRr.toFixed(2)} / costs $${cost.totalCosts.toFixed(2)}`,
        cost.reason || TRADING_COST_TOO_HIGH
      ),
      cost,
    };
  }

  return {
    allowed: true,
    quantity: sized.quantity,
    sizeUsdt: sized.sizeUsdt,
    marginUsdt: sized.marginUsdt,
    leverage: sized.leverage,
    explain: sized,
    cost,
  };
}

function deny(reason: string, code?: string): RiskDecision {
  return { allowed: false, reason, code, quantity: 0, sizeUsdt: 0, marginUsdt: 0, leverage: 1 };
}

/** PAPER default peak ($10k) must not block a smaller Futures Demo balance. */
export function peakForTradingVenue(params: {
  tradingMode: string;
  peakEquityUsdt: number;
  paperBalanceUsdt: number;
  equity: number;
}) {
  if (params.tradingMode !== "PAPER") {
    const looksLikePaperDefault = params.peakEquityUsdt >= 9999 && params.peakEquityUsdt <= 10001;
    if (looksLikePaperDefault && params.equity > 0 && params.equity < 9000) {
      return params.equity;
    }
  }
  const peak = params.peakEquityUsdt || params.equity;
  return peak > 0 ? peak : params.equity;
}
