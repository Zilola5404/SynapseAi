import type { RiskSettings, User } from "@prisma/client";
import type { RiskDecision, StrategySignal } from "../types.js";
import { sizePosition } from "./PositionSizer.js";

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
    return deny(`Дневной лимит убытка достигнут (${risk.maxDailyLossPct}%).`);
  }

  const peak = user.peakEquityUsdt || equity;
  if (peak > 0 && equity < peak) {
    const dd = ((peak - equity) / peak) * 100;
    if (dd >= risk.maxDrawdownPct) {
      return deny(`Просадка ${dd.toFixed(2)}% >= ${risk.maxDrawdownPct}%`);
    }
  }

  const sized = sizePosition({
    equity,
    riskPerTradePct: risk.riskPerTradePct,
    entry: signal.entryPrice,
    stopLoss: signal.stopLoss,
    maxLeverage: risk.maxLeverage,
  });

  if (sized.quantity <= 0 || sized.marginUsdt < 5) {
    return deny("Размер позиции слишком мал.");
  }

  const maxMargin = equity * (risk.maxPositionSizePct / 100);
  if (sized.marginUsdt > maxMargin) {
    sized.marginUsdt = maxMargin;
    sized.sizeUsdt = maxMargin * sized.leverage;
    sized.quantity = sized.sizeUsdt / signal.entryPrice;
  }

  const exposurePct = ((openExposureUsdt + sized.sizeUsdt) / equity) * 100;
  const maxExposure = risk.maxExposurePct || 30;
  if (exposurePct > maxExposure) {
    return deny(`Превышена экспозиция ${exposurePct.toFixed(1)}% / ${maxExposure}%`);
  }

  return {
    allowed: true,
    quantity: sized.quantity,
    sizeUsdt: sized.sizeUsdt,
    marginUsdt: sized.marginUsdt,
    leverage: sized.leverage,
  };
}

function deny(reason: string): RiskDecision {
  return { allowed: false, reason, quantity: 0, sizeUsdt: 0, marginUsdt: 0, leverage: 1 };
}
