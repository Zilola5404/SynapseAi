import "dotenv/config";
import { connectDb, prisma, disconnectDb } from "../server/db.js";
import { tradingOrchestrator } from "../server/trading/orchestrator/TradingOrchestrator.js";

async function main() {
  await connectDb();
  const user = await prisma.user.findFirst({ where: { telegramId: { not: null } } });
  if (!user) throw new Error("no telegram user");
  await tradingOrchestrator.unlock(user.id);
  const pos = await tradingOrchestrator.placeCertifiedTestOrder(user.id, "BTCUSDT");
  console.log(
    JSON.stringify({
      user: user.id.slice(0, 8),
      symbol: pos.symbol,
      orderId: pos.exchangeOrderId || pos.entryOrderId,
      qty: pos.quantity,
      entry: pos.entryPrice,
      sl: pos.stopLossPrice,
      slOrderId: pos.slOrderId,
      tpOrderId: pos.tpOrderId,
      paper: pos.isPaperTrade,
      status: pos.status,
    })
  );
  await disconnectDb();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
