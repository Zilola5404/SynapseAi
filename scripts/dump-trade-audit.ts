import "dotenv/config";
import { connectDb, prisma, disconnectDb } from "../server/db.js";

async function main() {
  const ok = await connectDb();
  if (!ok) {
    console.log(JSON.stringify({ db: false }));
    return;
  }
  const hist = await prisma.orderHistory.findMany({ orderBy: { createdAt: "asc" } });
  const orders = await prisma.exchangeOrder.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      symbol: true,
      side: true,
      purpose: true,
      status: true,
      exchangeOrderId: true,
      quantity: true,
      executedQty: true,
      avgFillPrice: true,
      feesUsdt: true,
      lastError: true,
      createdAt: true,
      positionId: true,
    },
  });
  const positions = await prisma.activePosition.findMany({
    select: {
      id: true,
      symbol: true,
      side: true,
      status: true,
      entryPrice: true,
      quantity: true,
      sizeUsdt: true,
      leverage: true,
      stopLossPrice: true,
      takeProfitPrice: true,
      isPaperTrade: true,
      exchangeOrderId: true,
      openedAt: true,
      closedAt: true,
      aiRationale: true,
    },
  });
  console.log(
    JSON.stringify(
      {
        hist: hist.map((h) => ({
          id: h.id,
          symbol: h.symbol,
          side: h.side,
          entry: h.entryPrice,
          exit: h.exitPrice,
          qty: h.quantity,
          size: h.sizeUsdt,
          lev: h.leverage,
          pnl: h.pnl,
          gross: h.grossPnl,
          entryFee: h.entryFeeUsdt,
          exitFee: h.exitFeeUsdt,
          fees: h.commissionUsdt,
          funding: h.fundingUsdt,
          reason: h.exitReason,
          xid: h.exchangeOrderId,
          pos: h.positionId,
          paper: h.isPaperTrade,
          opened: h.openedAt,
          closed: h.closedAt,
        })),
        orders: orders.map((o) => ({
          id: o.id,
          sym: o.symbol,
          side: o.side,
          pur: o.purpose,
          st: o.status,
          xid: o.exchangeOrderId,
          qty: o.quantity,
          exe: o.executedQty,
          avg: o.avgFillPrice,
          fee: o.feesUsdt,
          err: (o.lastError || "").slice(0, 120),
          pos: o.positionId,
          at: o.createdAt,
        })),
        positions: positions.map((p) => ({
          id: p.id,
          symbol: p.symbol,
          side: p.side,
          status: p.status,
          entry: p.entryPrice,
          qty: p.quantity,
          size: p.sizeUsdt,
          lev: p.leverage,
          sl: p.stopLossPrice,
          tp: p.takeProfitPrice,
          paper: p.isPaperTrade,
          xid: p.exchangeOrderId,
          opened: p.openedAt,
          closed: p.closedAt,
          rationale: (p.aiRationale || "").slice(0, 160),
        })),
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
