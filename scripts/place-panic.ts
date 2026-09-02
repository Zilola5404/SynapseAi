/**
 * Same path as Telegram /panic. Never prints API secrets.
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
    risk: risk.map((r) => ({ symbol: r.symbol, amt: r.positionAmt, uPnL: r.unRealizedProfit })),
    open: open.map((o) => ({ id: o.orderId, status: o.status })),
  };
}

async function main() {
  await connectDb();
  const user = await prisma.user.findFirst({ where: { telegramId: { not: null } } });
  if (!user) throw new Error("no telegram user");
  const steps = await tradingOrchestrator.panic(user.id);
  const after = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { accountLocked: true, scannerEnabled: true, autoTradeEnabled: true },
  });
  const open = await prisma.activePosition.findMany({
    where: { userId: user.id, status: { in: ["OPEN", "CLOSING"] } },
    select: { symbol: true, status: true, isPaperTrade: true },
  });
  console.log(
    JSON.stringify(
      {
        action: "panic",
        user: user.id.slice(0, 8),
        steps,
        after: { ...after, open, exchange: await exchangeSnap(user.id) },
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
