import { tradingOrchestrator } from "../orchestrator/TradingOrchestrator.js";
import { prisma } from "../../db.js";
import { notifyUser } from "../../telegram/notify.js";

export async function syncFillFromExchange(params: {
  userId: string;
  symbol: string;
  avgPrice: number;
  qty: number;
  realizedPnl?: number;
  commission?: number;
  reduceOnly?: boolean;
  orderId?: string;
  clientOrderId?: string;
  execType?: string;
}) {
  await tradingOrchestrator.onExchangeFill({
    userId: params.userId,
    symbol: params.symbol,
    avgPrice: params.avgPrice,
    qty: params.qty,
    realizedPnl: params.realizedPnl,
    commission: params.commission,
    reduceOnly: params.reduceOnly,
    orderId: params.orderId,
  });
}

export async function syncAccountEquity(userId: string, equity: number) {
  if (!(equity > 0)) return;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;
  if (user.tradingMode === "LIVE") {
    await prisma.user.update({ where: { id: userId }, data: { liveEquityUsdt: equity } });
  } else if (user.tradingMode === "TESTNET") {
    await prisma.user.update({ where: { id: userId }, data: { testnetEquityUsdt: equity } });
  }
}

export async function alertManualClose(userId: string, symbol: string, reason: string) {
  await notifyUser(userId, `📡 ${symbol}: сделка закрыта на бирже.`);
}
