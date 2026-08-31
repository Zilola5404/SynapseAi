import { Router } from "express";
import { requireJwt, AuthedRequest } from "../auth/middleware.js";
import { placeGuardedOrder, closePosition, triggerKillSwitch, resetKillSwitch, accountEquity } from "../services/orderService.js";
import { prisma } from "../db.js";

export const tradingRouter = Router();

tradingRouter.get("/positions", requireJwt, async (req: AuthedRequest, res) => {
  const positions = await prisma.activePosition.findMany({
    where: { userId: req.userId },
    orderBy: { openedAt: "desc" },
  });
  res.json({ success: true, positions });
});

tradingRouter.get("/history", requireJwt, async (req: AuthedRequest, res) => {
  const orders = await prisma.orderHistory.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json({ success: true, orders });
});

tradingRouter.get("/equity", requireJwt, async (req: AuthedRequest, res) => {
  const equity = await accountEquity(req.userId!);
  res.json({ success: true, equity });
});

tradingRouter.post("/order", requireJwt, async (req: AuthedRequest, res) => {
  try {
    const { symbol, side, marginUsdt, leverage, stopLossPrice, takeProfitPrice } = req.body || {};
    const result = await placeGuardedOrder({
      userId: req.userId!,
      symbol: String(symbol),
      side: String(side).toUpperCase() === "SHORT" ? "SHORT" : "LONG",
      marginUsdt: Number(marginUsdt),
      leverage: Number(leverage || 5),
      stopLossPrice: stopLossPrice ? Number(stopLossPrice) : undefined,
      takeProfitPrice: takeProfitPrice ? Number(takeProfitPrice) : undefined,
    });
    res.json({
      success: true,
      position: result.position,
      order: {
        orderId: result.order.orderId,
        status: result.order.status,
        isPaperTrade: result.order.isPaperTrade,
        price: result.order.price,
      },
    });
  } catch (err: unknown) {
    res.status(400).json({ success: false, message: err instanceof Error ? err.message : "Order rejected" });
  }
});

tradingRouter.post("/close", requireJwt, async (req: AuthedRequest, res) => {
  try {
    const result = await closePosition({
      userId: req.userId!,
      positionId: String(req.body.positionId),
      reason: "MANUAL",
    });
    res.json({ success: true, ...result });
  } catch (err: unknown) {
    res.status(400).json({ success: false, message: err instanceof Error ? err.message : "Close failed" });
  }
});

tradingRouter.post("/kill-switch", requireJwt, async (req: AuthedRequest, res) => {
  const result = await triggerKillSwitch(req.userId!);
  res.json({ success: true, ...result });
});

tradingRouter.post("/kill-switch/reset", requireJwt, async (req: AuthedRequest, res) => {
  await resetKillSwitch(req.userId!);
  res.json({ success: true });
});
