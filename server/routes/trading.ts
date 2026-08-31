import { Router } from "express";
import { requireJwt, AuthedRequest } from "../auth/middleware.js";
import { accountEquity } from "../services/orderService.js";
import { tradingOrchestrator } from "../trading/orchestrator/TradingOrchestrator.js";
import { prisma } from "../db.js";
import { livePositionStatus } from "../trading/positionState.js";

export const tradingRouter = Router();

tradingRouter.get("/positions", requireJwt, async (req: AuthedRequest, res) => {
  const positions = await prisma.activePosition.findMany({
    where: { userId: req.userId, status: livePositionStatus },
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
  res.status(410).json({
    success: false,
    deprecated: true,
    message: "Use TradingOrchestrator via Telegram /scan. Direct API orders are disabled.",
  });
});

tradingRouter.post("/close", requireJwt, async (req: AuthedRequest, res) => {
  try {
    const result = await tradingOrchestrator.closePosition(req.userId!, String(req.body.positionId), "MANUAL");
    res.json({ success: true, ...result });
  } catch (err: unknown) {
    res.status(400).json({ success: false, message: err instanceof Error ? err.message : "Close failed" });
  }
});

tradingRouter.post("/kill-switch", requireJwt, async (req: AuthedRequest, res) => {
  const steps = await tradingOrchestrator.panic(req.userId!);
  res.json({ success: true, steps });
});

tradingRouter.post("/kill-switch/reset", requireJwt, async (req: AuthedRequest, res) => {
  await tradingOrchestrator.unlock(req.userId!);
  res.json({ success: true });
});
