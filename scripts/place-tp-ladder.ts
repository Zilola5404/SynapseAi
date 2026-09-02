/**
 * TP ladder cert: 0.01 BTC so 30/30/40 legs meet minQty 0.001.
 * Then force scale-out 0.003 / 0.003 / rest. Never prints secrets.
 */
import "dotenv/config";
import { connectDb, prisma, disconnectDb } from "../server/db.js";
import { getDecryptedCredentials } from "../server/services/credentialService.js";
import { getPositionRisk, listOpenFuturesOrders } from "../server/exchanges/binance/futuresClient.js";
import { splitScaleOutQty } from "../server/exchanges/binance/precision.js";
import { TP_SCALE_OUT } from "../server/trading/tpPolicy.js";
import { tradingOrchestrator } from "../server/trading/orchestrator/TradingOrchestrator.js";

async function snap(userId: string) {
  const c = await getDecryptedCredentials(userId);
  if (!c) return null;
  const risk = await getPositionRisk(c.apiKey, c.apiSecret, true, "BTCUSDT");
  const open = await listOpenFuturesOrders({
    apiKey: c.apiKey,
    apiSecret: c.apiSecret,
    isTestnet: true,
    symbol: "BTCUSDT",
  });
  const db = await prisma.activePosition.findMany({
    where: { userId, status: { in: ["OPEN", "CLOSING"] }, isPaperTrade: false },
    select: { id: true, quantity: true, status: true, slOrderId: true, tpOrderId: true, exchangeOrderId: true },
  });
  return {
    db,
    amt: risk[0]?.positionAmt || 0,
    orders: open.map((o) => ({ id: o.orderId, qty: o.origQty, type: o.type, status: o.status })),
  };
}

async function main() {
  await connectDb();
  const user = await prisma.user.findFirst({ where: { telegramId: { not: null } } });
  if (!user) throw new Error("no telegram user");
  await tradingOrchestrator.unlock(user.id);
  const qty = 0.01;
  const legs = splitScaleOutQty("BTCUSDT", qty, TP_SCALE_OUT, true);
  const pos = await tradingOrchestrator.placeCertifiedTestOrder(user.id, "BTCUSDT", { quantity: qty });
  const afterOpen = await snap(user.id);
  const steps = [];
  if (legs && pos.id) {
    const orig = pos.quantity;
    const s1 = await tradingOrchestrator.scaleOutQty(user.id, pos.id, legs[0], "TP1");
    const p1 = await snap(user.id);
    steps.push({ name: "TP1", closed: legs[0], remainPct: ((p1?.amt || 0) / orig) * 100, s1, exchange: p1 });
    const s2 = await tradingOrchestrator.scaleOutQty(user.id, pos.id, legs[1], "TP2");
    const p2 = await snap(user.id);
    steps.push({ name: "TP2", closed: legs[1], remainPct: ((p2?.amt || 0) / orig) * 100, s2, exchange: p2 });
    await tradingOrchestrator.closePosition(user.id, pos.id, "TP3");
    const p3 = await snap(user.id);
    steps.push({ name: "TP3", remainPct: ((p3?.amt || 0) / orig) * 100, exchange: p3 });
  } else {
    if (pos.id) await tradingOrchestrator.closePosition(user.id, pos.id, "MANUAL");
  }
  console.log(
    JSON.stringify(
      {
        qty,
        legs,
        open: {
          orderId: pos.exchangeOrderId,
          qty: pos.quantity,
          sl: pos.slOrderId,
          tp: pos.tpOrderId,
          paper: pos.isPaperTrade,
        },
        afterOpen,
        steps,
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
