/**
 * Same path as Telegram /testclose. Never prints API secrets.
 */
import "dotenv/config";
import { connectDb, prisma, disconnectDb } from "../server/db.js";
import { getDecryptedCredentials } from "../server/services/credentialService.js";
import { getPositionRisk, listOpenFuturesOrders } from "../server/exchanges/binance/futuresClient.js";
import { tradingOrchestrator } from "../server/trading/orchestrator/TradingOrchestrator.js";

async function exchangeSnap(userId: string) {
  const c = await getDecryptedCredentials(userId);
  if (!c) return null;
  const risk = await getPositionRisk(c.apiKey, c.apiSecret, true, "BTCUSDT");
  const open = await listOpenFuturesOrders({
    apiKey: c.apiKey,
    apiSecret: c.apiSecret,
    isTestnet: true,
    symbol: "BTCUSDT",
  });
  return {
    risk: risk.map((r) => ({
      symbol: r.symbol,
      amt: r.positionAmt,
      entry: r.entryPrice,
      mark: r.markPrice,
      uPnL: r.unRealizedProfit,
    })),
    open: open.map((o) => ({ id: o.orderId, type: o.type, status: o.status })),
  };
}

async function main() {
  await connectDb();
  const user = await prisma.user.findFirst({ where: { telegramId: { not: null } } });
  if (!user) throw new Error("no telegram user");

  const open = await prisma.activePosition.findMany({
    where: { userId: user.id, status: { in: ["OPEN", "CLOSING"] }, isPaperTrade: false },
  });
  const before = {
    locked: user.accountLocked,
    mode: user.tradingMode,
    open: open.map((p) => ({
      id: p.id.slice(0, 8),
      symbol: p.symbol,
      status: p.status,
      qty: p.quantity,
      entry: p.entryPrice,
      orderId: p.exchangeOrderId,
      sl: p.slOrderId,
      tp: p.tpOrderId,
    })),
    exchange: await exchangeSnap(user.id),
  };

  if (!open.length) {
    console.log(JSON.stringify({ action: "none", reason: "no TESTNET position to close", before }, null, 2));
    await disconnectDb();
    return;
  }

  const results = [];
  for (const row of open) {
    results.push(await tradingOrchestrator.closePosition(user.id, row.id, "MANUAL"));
  }

  const afterDb = await prisma.activePosition.findMany({
    where: { userId: user.id, status: { in: ["OPEN", "CLOSING", "CLOSED"] } },
    orderBy: { updatedAt: "desc" },
    take: 3,
    select: { symbol: true, status: true, isPaperTrade: true, quantity: true, entryPrice: true, currentPrice: true },
  });
  const hist = await prisma.orderHistory.findFirst({
    where: { userId: user.id, isPaperTrade: false },
    orderBy: { closedAt: "desc" },
    select: {
      symbol: true,
      pnl: true,
      pnlPct: true,
      exitReason: true,
      commissionUsdt: true,
      entryFeeUsdt: true,
      exitFeeUsdt: true,
      grossPnl: true,
      exitPrice: true,
      entryPrice: true,
      quantity: true,
      exchangeOrderId: true,
    },
  });

  console.log(
    JSON.stringify(
      {
        action: "testclose",
        user: user.id.slice(0, 8),
        before,
        results,
        after: { positions: afterDb, history: hist, exchange: await exchangeSnap(user.id) },
      },
      null,
      2
    )
  );
  await disconnectDb();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
