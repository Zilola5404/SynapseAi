import "dotenv/config";
import { connectDb, prisma, disconnectDb } from "../server/db.js";

async function main() {
  await connectDb();
  const u = await prisma.user.findFirst({
    where: { telegramId: { not: null } },
    select: {
      id: true,
      tradingMode: true,
      peakEquityUsdt: true,
      paperBalanceUsdt: true,
      testnetEquityUsdt: true,
      liveEquityUsdt: true,
    },
  });
  console.log(JSON.stringify({ ...u, id: u?.id.slice(0, 8) }));
  await disconnectDb();
}
main().catch(async (e) => {
  console.error(e);
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
