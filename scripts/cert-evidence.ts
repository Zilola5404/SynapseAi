/**
 * Certification evidence dump. Never prints API secrets.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { connectDb, prisma, disconnectDb } from "../server/db.js";
import { summarizeStrategyValidation } from "../server/trading/strategy/setupStats.js";

const out = path.resolve("ai-docs/reports/qa_evidence/testnet_cert_evidence.json");

async function main() {
  await connectDb();
  const users = await prisma.user.findMany({
    select: {
      id: true,
      tradingMode: true,
      accountLocked: true,
      scannerEnabled: true,
      autoTradeEnabled: true,
      telegramId: true,
    },
  });
  const history = await prisma.orderHistory.findMany({
    where: { isPaperTrade: false },
    orderBy: { closedAt: "desc" },
    take: 10,
    select: {
      symbol: true,
      side: true,
      entryPrice: true,
      exitPrice: true,
      quantity: true,
      pnl: true,
      pnlPct: true,
      grossPnl: true,
      entryFeeUsdt: true,
      exitFeeUsdt: true,
      commissionUsdt: true,
      fundingUsdt: true,
      exitReason: true,
      exchangeOrderId: true,
      isPaperTrade: true,
      openedAt: true,
      closedAt: true,
    },
  });
  const open = await prisma.activePosition.findMany({
    where: { status: { in: ["OPEN", "CLOSING"] } },
    select: {
      symbol: true,
      status: true,
      isPaperTrade: true,
      quantity: true,
      entryPrice: true,
      exchangeOrderId: true,
      slOrderId: true,
      tpOrderId: true,
    },
  });
  const signals = await prisma.signal.findMany({
    select: { status: true, factorsJson: true, strategy: true },
    take: 200,
    orderBy: { createdAt: "desc" },
  });
  const grades = signals.map((s) => {
    let grade = "NO_TRADE";
    try {
      const j = JSON.parse(s.factorsJson || "{}") as { grade?: string };
      if (j.grade) grade = j.grade;
    } catch {
      /* ignore */
    }
    return { grade, pnl: 0, fees: 0 };
  });
  const stats = summarizeStrategyValidation(grades);
  const evidence = {
    at: new Date().toISOString(),
    allowLive: process.env.ALLOW_LIVE === "true",
    users: users.map((u) => ({
      id: u.id.slice(0, 8),
      mode: u.tradingMode,
      locked: u.accountLocked,
      scanner: u.scannerEnabled,
      auto: u.autoTradeEnabled,
      hasTelegram: Boolean(u.telegramId),
    })),
    openPositions: open,
    lastTestnetCloses: history,
    signalGradeCounts: {
      "A+": stats["A+"].trades,
      A: stats.A.trades,
      B: stats.B.trades,
      sampleTooSmall: stats.sampleTooSmall,
    },
  };
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
  await disconnectDb();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
