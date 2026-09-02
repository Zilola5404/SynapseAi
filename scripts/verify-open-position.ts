import "dotenv/config";
import { connectDb, prisma, disconnectDb } from "../server/db.js";
import { getDecryptedCredentials } from "../server/services/credentialService.js";
import { getPositionRisk, listOpenFuturesOrders } from "../server/exchanges/binance/futuresClient.js";

async function main() {
  await connectDb();
  const u = await prisma.user.findFirst({
    where: { telegramId: { not: null } },
    select: { id: true, accountLocked: true, tradingMode: true },
  });
  const p = await prisma.activePosition.findMany({
    where: { status: { in: ["OPEN", "CLOSING"] } },
    select: {
      symbol: true,
      status: true,
      isPaperTrade: true,
      exchangeOrderId: true,
      slOrderId: true,
      tpOrderId: true,
      entryPrice: true,
      quantity: true,
      currentPrice: true,
    },
  });
  let exchange = null;
  if (u) {
    const c = await getDecryptedCredentials(u.id);
    if (c) {
      const risk = await getPositionRisk(c.apiKey, c.apiSecret, true, "BTCUSDT");
      const open = await listOpenFuturesOrders({
        apiKey: c.apiKey,
        apiSecret: c.apiSecret,
        isTestnet: true,
        symbol: "BTCUSDT",
      });
      exchange = {
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
  }
  console.log(
    JSON.stringify(
      {
        user: u ? { id: u.id.slice(0, 8), mode: u.tradingMode, locked: u.accountLocked } : null,
        positions: p,
        exchange,
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
