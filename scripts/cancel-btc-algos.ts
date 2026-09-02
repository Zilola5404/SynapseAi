import "dotenv/config";
import { connectDb, prisma, disconnectDb } from "../server/db.js";
import { getDecryptedCredentials } from "../server/services/credentialService.js";
import { cancelAllFuturesOrders, getPositionRisk } from "../server/exchanges/binance/futuresClient.js";

async function main() {
  await connectDb();
  const user = await prisma.user.findFirst({ where: { telegramId: { not: null } } });
  if (!user) throw new Error("no user");
  const c = await getDecryptedCredentials(user.id);
  if (!c) throw new Error("no keys");
  const cancel = await cancelAllFuturesOrders({
    apiKey: c.apiKey,
    apiSecret: c.apiSecret,
    isTestnet: true,
    symbol: "BTCUSDT",
  });
  const risk = await getPositionRisk(c.apiKey, c.apiSecret, true, "BTCUSDT");
  console.log(JSON.stringify({ cancelled: cancel.length, amt: risk[0]?.positionAmt || 0 }));
  await disconnectDb();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
