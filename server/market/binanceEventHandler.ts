import { logger } from "../logger.js";
import { notifyUser } from "../telegram/notify.js";
import { syncOrderFromExchange } from "../trading/sync/OrderSynchronizer.js";
import { alertManualClose, syncAccountEquity, syncFillFromExchange } from "../trading/sync/PositionSynchronizer.js";
import { prisma } from "../db.js";
import { livePositionStatus } from "../trading/positionState.js";

export async function handleBinanceUserEvent(userId: string, msg: any) {
  if (msg.e === "ORDER_TRADE_UPDATE") {
    const o = msg.o || {};
    const status = String(o.X || "");
    const execType = String(o.x || "");
    const symbol = String(o.s || "");
    const orderId = String(o.i || "");
    const clientOrderId = String(o.c || o.C || "");
    await syncOrderFromExchange({
      clientOrderId,
      exchangeOrderId: orderId,
      status,
      executedQty: parseFloat(o.z || o.l || "0"),
      avgPrice: parseFloat(o.ap || o.L || "0"),
      reason: `uds ${execType} ${status}`,
      raw: { X: status, x: execType, i: orderId },
    });

    if (execType === "TRADE" && (status === "FILLED" || status === "PARTIALLY_FILLED")) {
      const reduceOnly = Boolean(o.R);
      await syncFillFromExchange({
        userId,
        symbol,
        avgPrice: parseFloat(o.ap || o.L || "0"),
        qty: parseFloat(o.z || o.l || "0"),
        realizedPnl: parseFloat(o.rp || "0"),
        commission: parseFloat(o.n || "0"),
        reduceOnly,
        orderId,
        clientOrderId,
        execType,
      });
      const pos = await prisma.activePosition.findFirst({
        where: { userId, symbol, status: livePositionStatus },
      });
      if (reduceOnly && pos) {
        logger.info({ userId, symbol, orderId }, "reduce-only fill on live position");
      }
    }
    if (status === "CANCELED" || execType === "CANCELED") {
      logger.info({ userId, symbol, orderId }, "order cancelled on exchange");
    }
    if (status === "EXPIRED" || status === "REJECTED") {
      await notifyUser(
        userId,
        `⚠️ Заявка по ${symbol} не исполнена.\nСистема попробует обработать это автоматически.`
      );
    }
  }

  if (msg.e === "ACCOUNT_UPDATE") {
    const reason = String(msg.a?.m || "");
    const bal = (msg.a?.B || []).find((b: any) => b.a === "USDT");
    const equity = bal ? parseFloat(bal.wb || bal.cw || "0") : 0;
    await syncAccountEquity(userId, equity);
    if (reason === "ORDER" || reason === "FUNDING_FEE") {
      logger.info({ userId, reason, equity }, "account update");
    }
    const positions = msg.a?.P || [];
    for (const p of positions) {
      const amt = parseFloat(p.pa || "0");
      const symbol = String(p.s || "");
      if (!symbol) continue;
      const db = await prisma.activePosition.findFirst({
        where: { userId, symbol, isPaperTrade: false, status: livePositionStatus },
      });
      if (db && Math.abs(amt) < 1e-8) {
        await alertManualClose(userId, symbol, "position flat on exchange (ACCOUNT_UPDATE)");
      }
    }
  }
}
