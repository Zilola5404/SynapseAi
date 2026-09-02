import "dotenv/config";
import { connectDb, prisma, disconnectDb } from "../server/db.js";

async function main() {
  const ok = await connectDb();
  if (!ok) {
    console.log(JSON.stringify({ db: false }));
    return;
  }
  const users = await prisma.user.findMany({
    select: {
      id: true,
      tradingMode: true,
      accountLocked: true,
      telegramId: true,
      credentials: { select: { isTestnet: true, apiKeyMask: true, tradingType: true } },
    },
  });
  const open = await prisma.activePosition.findMany({
    where: { status: { in: ["OPEN", "CLOSING"] } },
    select: {
      id: true,
      symbol: true,
      status: true,
      isPaperTrade: true,
      updatedAt: true,
      currentPrice: true,
    },
  });
  console.log(
    JSON.stringify({
      db: true,
      users: users.map((u) => ({
        id: u.id.slice(0, 8),
        mode: u.tradingMode,
        locked: u.accountLocked,
        hasTg: Boolean(u.telegramId),
        creds: u.credentials
          ? { mask: u.credentials.apiKeyMask, testnet: u.credentials.isTestnet, type: u.credentials.tradingType }
          : null,
      })),
      open,
    })
  );
  await disconnectDb();
}

main().catch(async (err) => {
  console.log(JSON.stringify({ db: false, error: err instanceof Error ? err.message : String(err) }));
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
