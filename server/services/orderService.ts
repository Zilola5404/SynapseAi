import { prisma } from "../db.js";
import { validateOrderRisk, type ServerRiskSettings } from "../risk.js";
import { getDecryptedCredentials } from "./credentialService.js";
import { writeSystemLog } from "./logService.js";
import {
  placeBinanceOrder,
  placeFuturesProtectiveOrders,
  closeFuturesMarketPosition,
  cancelBinanceOrder,
  fetchBinanceOpenOrders,
  fetchBinanceAccountBalance,
} from "../binance.js";
import { binanceWsManager } from "../websocket.js";
import { logger } from "../logger.js";
import { livePositionStatus } from "../trading/positionState.js";

export async function realizedPnl24h(userId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await prisma.orderHistory.aggregate({
    where: { userId, closedAt: { gte: since } },
    _sum: { pnl: true },
  });
  return rows._sum.pnl ?? 0;
}

export async function accountEquity(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return 0;

  try {
    const creds = await getDecryptedCredentials(userId);
    if (creds) {
      const bal = await fetchBinanceAccountBalance(creds.apiKey, creds.apiSecret, creds.isTestnet);
      return bal.totalEquityUsdt;
    }
  } catch (err) {
    logger.warn({ err, userId }, "Баланс Binance недоступен, используется paper-баланс");
  }
  return user.paperBalanceUsdt;
}

export async function placeGuardedOrder(params: {
  userId: string;
  symbol: string;
  side: "LONG" | "SHORT";
  marginUsdt: number;
  leverage: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  aiRationale?: string;
  aiConfidence?: number;
  riskLevel?: string;
}) {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    include: { riskSettings: true },
  });
  if (!user?.riskSettings) {
    throw new Error("Профиль риска не найден");
  }

  const risk = user.riskSettings as ServerRiskSettings;
  const openCount = await prisma.activePosition.count({ where: { userId: params.userId, status: livePositionStatus } });
  const pnl24h = await realizedPnl24h(params.userId);
  const equity = await accountEquity(params.userId);

  const validation = validateOrderRisk({
    symbol: params.symbol,
    side: params.side === "LONG" ? "BUY" : "SELL",
    marginUsdt: params.marginUsdt,
    leverage: params.leverage,
    accountEquity: equity,
    activePositionsCount: openCount,
    realizedPnL24h: pnl24h,
    peakEquityUsdt: user.peakEquityUsdt,
    currentEquityUsdt: equity,
    riskSettings: risk,
  });

  if (!validation.allowed) {
    await writeSystemLog({
      userId: params.userId,
      level: "RISK_WARN",
      pair: params.symbol,
      action: "ORDER_BLOCKED",
      details: validation.reason || "Ордер отклонён риск-фильтром",
    });
    throw new Error(validation.reason || "Ордер заблокирован риск-движком");
  }

  const markPrice = binanceWsManager.getPrice(params.symbol);
  if (!markPrice) {
    throw new Error(`Нет живой цены по ${params.symbol}. Подождите подключения WebSocket.`);
  }

  const quantity = Number(((params.marginUsdt * params.leverage) / markPrice).toFixed(4));
  if (quantity <= 0) {
    throw new Error("Количество контракта слишком мало");
  }

  const stopLossPrice = params.stopLossPrice ?? (params.side === "LONG"
    ? Number((markPrice * (1 - user.riskSettings.defaultStopLossPct / 100)).toFixed(4))
    : Number((markPrice * (1 + user.riskSettings.defaultStopLossPct / 100)).toFixed(4)));
  const takeProfitPrice = params.takeProfitPrice ?? (params.side === "LONG"
    ? Number((markPrice * (1 + user.riskSettings.defaultTakeProfitPct / 100)).toFixed(4))
    : Number((markPrice * (1 - user.riskSettings.defaultTakeProfitPct / 100)).toFixed(4)));

  const creds = await getDecryptedCredentials(params.userId).catch(() => null);
  const binanceSide = params.side === "LONG" ? "BUY" : "SELL";

  const order = await placeBinanceOrder({
    symbol: params.symbol,
    side: binanceSide,
    type: "MARKET",
    quantity,
    markPrice,
    isFutures: (creds?.tradingType ?? "FUTURES") === "FUTURES",
    isTestnet: creds?.isTestnet ?? true,
    apiKey: creds?.apiKey,
    apiSecret: creds?.apiSecret,
  });

  let slOrderId: string | undefined;
  let tpOrderId: string | undefined;
  if (creds && !order.isPaperTrade && creds.tradingType === "FUTURES") {
    try {
      const prot = await placeFuturesProtectiveOrders({
        symbol: params.symbol,
        side: binanceSide,
        stopLossPrice,
        takeProfitPrice,
        apiKey: creds.apiKey,
        apiSecret: creds.apiSecret,
        isTestnet: creds.isTestnet,
      });
      slOrderId = prot.slOrderId;
      tpOrderId = prot.tpOrderId;
    } catch (err) {
      logger.warn({ err }, "Не удалось выставить SL/TP на бирже, серверный монитор продолжит защиту");
    }
  }

  const entryPrice = order.price > 0 ? order.price : markPrice;
  const leverage = params.leverage;
  const liquidationPrice =
    params.side === "LONG" ? entryPrice * (1 - 0.9 / leverage) : entryPrice * (1 + 0.9 / leverage);

  const position = await prisma.activePosition.create({
    data: {
      userId: params.userId,
      symbol: params.symbol.replace("/", "").toUpperCase(),
      side: params.side,
      entryPrice,
      currentPrice: entryPrice,
      sizeUsdt: Number((params.marginUsdt * leverage).toFixed(2)),
      marginUsdt: params.marginUsdt,
      quantity,
      leverage,
      liquidationPrice,
      stopLossPrice,
      takeProfitPrice,
      exchangeOrderId: String(order.orderId),
      slOrderId,
      tpOrderId,
      isPaperTrade: Boolean(order.isPaperTrade),
      aiRationale: params.aiRationale || "",
      aiConfidence: params.aiConfidence || 0,
      riskLevel: params.riskLevel || "MEDIUM",
    },
  });

  await prisma.user.update({
    where: { id: params.userId },
    data: {
      paperBalanceUsdt: { decrement: params.marginUsdt },
      peakEquityUsdt: Math.max(user.peakEquityUsdt, equity),
    },
  });

  await writeSystemLog({
    userId: params.userId,
    level: "TRADE",
    pair: position.symbol,
    action: `OPEN_${params.side}`,
    details: `Ордер ${order.isPaperTrade ? "PAPER" : order.orderId} qty=${quantity} entry=${entryPrice} SL=${stopLossPrice} TP=${takeProfitPrice}`,
    reasoning: params.aiRationale,
    confidence: params.aiConfidence,
  });

  return { position, order, validation };
}

export async function closePosition(params: {
  userId: string;
  positionId: string;
  reason: "TAKE_PROFIT" | "STOP_LOSS" | "MANUAL" | "MAX_DRAWDOWN" | "KILL_SWITCH" | "AI_SIGNAL";
  exitPrice?: number;
}) {
  const pos = await prisma.activePosition.findFirst({
    where: { id: params.positionId, userId: params.userId, status: livePositionStatus },
  });
  if (!pos) throw new Error("Position not found or already closed");

  const exitPrice = params.exitPrice || binanceWsManager.getPrice(pos.symbol) || pos.currentPrice;
  const isLong = pos.side === "LONG";
  const priceDiff = isLong ? exitPrice - pos.entryPrice : pos.entryPrice - exitPrice;
  const pnl = (priceDiff / pos.entryPrice) * pos.sizeUsdt;
  const pnlPct = pos.marginUsdt > 0 ? (pnl / pos.marginUsdt) * 100 : 0;

  if (!pos.isPaperTrade) {
    try {
      const creds = await getDecryptedCredentials(params.userId);
      if (creds) {
        await closeFuturesMarketPosition({
          symbol: pos.symbol,
          side: pos.side === "LONG" ? "BUY" : "SELL",
          quantity: pos.quantity,
          apiKey: creds.apiKey,
          apiSecret: creds.apiSecret,
          isTestnet: creds.isTestnet,
        });
      }
    } catch (err) {
      logger.warn({ err, positionId: pos.id }, "Ошибка закрытия на Binance, позиция всё равно закрывается в БД");
    }
  }

  await prisma.orderHistory.create({
    data: {
      userId: params.userId,
      symbol: pos.symbol,
      side: pos.side,
      entryPrice: pos.entryPrice,
      exitPrice,
      sizeUsdt: pos.sizeUsdt,
      quantity: pos.quantity,
      leverage: pos.leverage,
      pnl: Number(pnl.toFixed(2)),
      pnlPct: Number(pnlPct.toFixed(2)),
      status: "CLOSED",
      exitReason: params.reason,
      exchangeOrderId: pos.exchangeOrderId,
      isPaperTrade: pos.isPaperTrade,
      aiConfidence: pos.aiConfidence,
      openedAt: pos.openedAt,
      closedAt: new Date(),
    },
  });

  await prisma.activePosition.update({
    where: { id: pos.id },
    data: { status: "CLOSED", closedAt: new Date() },
  });

  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  const newPaper = (user?.paperBalanceUsdt ?? 0) + pos.marginUsdt + pnl;
  await prisma.user.update({
    where: { id: params.userId },
    data: {
      paperBalanceUsdt: Number(newPaper.toFixed(2)),
      peakEquityUsdt: Math.max(user?.peakEquityUsdt ?? 0, newPaper),
    },
  });

  await writeSystemLog({
    userId: params.userId,
    level: params.reason === "STOP_LOSS" || params.reason === "KILL_SWITCH" ? "RISK_WARN" : "TRADE",
    pair: pos.symbol,
    action: `CLOSE_${params.reason}`,
    details: `Выход ${exitPrice}. PnL ${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} USDT (${pnlPct.toFixed(2)}%)`,
  });

  return { pnl, pnlPct, exitPrice, symbol: pos.symbol, side: pos.side };
}

export async function triggerKillSwitch(userId: string) {
  await prisma.riskSettings.update({
    where: { userId },
    data: { emergencyKillSwitch: true },
  });
  await prisma.user.update({
    where: { id: userId },
    data: { autoTradeEnabled: false },
  });

  const positions = await prisma.activePosition.findMany({ where: { userId, status: livePositionStatus } });
  const closed = [];
  for (const pos of positions) {
    closed.push(await closePosition({ userId, positionId: pos.id, reason: "KILL_SWITCH" }));
  }

  try {
    const creds = await getDecryptedCredentials(userId);
    if (creds) {
      const openOrders = await fetchBinanceOpenOrders(undefined, creds.apiKey, creds.apiSecret, creds.isTestnet, creds.tradingType === "FUTURES");
      for (const order of openOrders) {
        await cancelBinanceOrder(order.symbol, order.orderId, creds.apiKey, creds.apiSecret, creds.isTestnet, creds.tradingType === "FUTURES");
      }
    }
  } catch (err) {
    logger.warn({ err, userId }, "Kill switch: не все биржевые ордера отменены");
  }

  await writeSystemLog({
    userId,
    level: "RISK_WARN",
    action: "KILL_SWITCH",
    details: `Аварийная остановка. Закрыто позиций: ${closed.length}`,
  });

  return { closedCount: closed.length, closed };
}

export async function resetKillSwitch(userId: string) {
  await prisma.riskSettings.update({
    where: { userId },
    data: { emergencyKillSwitch: false },
  });
  await writeSystemLog({
    userId,
    level: "INFO",
    action: "KILL_SWITCH_RESET",
    details: "Аварийный режим снят. Автоторговлю нужно включить отдельно.",
  });
}
