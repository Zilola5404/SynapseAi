import { prisma } from "../db.js";
import { summarizePaperSoak, type PaperSoakReport } from "../trading/paperSoak.js";

export async function loadPaperSoak(userId: string): Promise<PaperSoakReport> {
  const [trades, positions] = await Promise.all([
    prisma.orderHistory.findMany({
      where: { userId, isPaperTrade: true },
      orderBy: { closedAt: "asc" },
    }),
    prisma.activePosition.findMany({ where: { userId, isPaperTrade: true } }),
  ]);
  return summarizePaperSoak({
    trades: trades.map((t) => ({
      symbol: t.symbol,
      pnl: t.pnl,
      fees: t.commissionUsdt || 0,
      sizeUsdt: t.sizeUsdt,
      entryPrice: t.entryPrice,
      exitPrice: t.exitPrice,
      reason: t.exitReason,
      isPaper: t.isPaperTrade,
      closedAt: t.closedAt,
    })),
    positions: positions.map((p) => ({
      symbol: p.symbol,
      status: p.status,
      closeRequestedAt: p.closeRequestedAt,
      isPaper: p.isPaperTrade,
    })),
  });
}
