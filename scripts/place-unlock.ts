import "dotenv/config";
import { connectDb, prisma, disconnectDb } from "../server/db.js";
import { tradingOrchestrator } from "../server/trading/orchestrator/TradingOrchestrator.js";

async function main() {
  await connectDb();
  const user = await prisma.user.findFirst({ where: { telegramId: { not: null } } });
  if (!user) throw new Error("no telegram user");
  await tradingOrchestrator.unlock(user.id);
  const after = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { accountLocked: true },
  });
  console.log(JSON.stringify({ action: "unlock", user: user.id.slice(0, 8), locked: after.accountLocked }));
  await disconnectDb();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
