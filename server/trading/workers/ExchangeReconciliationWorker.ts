import { prisma } from "../../db.js";
import { logger } from "../../logger.js";
import { writeSystemLog } from "../../services/logService.js";
import { notifyUser } from "../../telegram/notify.js";
import { tradingOrchestrator, providerFor } from "../orchestrator/TradingOrchestrator.js";
import { equityForUser } from "../equity.js";

export class ExchangeReconciliationWorker {
  async runForUser(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.tradingMode === "PAPER") return { ok: true, diffs: [] as string[] };

    const posDiffs = await tradingOrchestrator.reconcileUser(userId);
    const diffs = [...(posDiffs.diffs || [])];

    try {
      const exec = await providerFor(user);
      const open = (await exec.listOpenOrders?.()) || [];
      const dbOpen = await prisma.exchangeOrder.findMany({
        where: { userId, status: { in: ["SUBMITTED", "ACKNOWLEDGED", "PARTIALLY_FILLED", "PROTECTION_PENDING", "PROTECTED"] } },
      });
      for (const row of dbOpen) {
        if (row.purpose === "ENTRY" || row.purpose === "CLOSE") continue;
        const onEx = open.find((o) => o.clientOrderId === row.clientOrderId || o.orderId === row.exchangeOrderId);
        if (!onEx) diffs.push(`DB order ${row.purpose} ${row.symbol} cid=${row.clientOrderId} missing on exchange`);
      }
    } catch (err) {
      diffs.push(`open-orders reconcile failed: ${err instanceof Error ? err.message : err}`);
    }

    try {
      await equityForUser(user);
    } catch (err) {
      diffs.push(`equity failed: ${err instanceof Error ? err.message : err}`);
      await notifyUser(userId, "⚠️ Reconciliation: не удалось прочитать equity с биржи.");
    }

    const critical = diffs.filter((d) => /missing|FLAT|failed/i.test(d));
    if (critical.length) {
      await writeSystemLog({
        userId,
        level: "RISK_WARN",
        action: "RECONCILE_WORKER",
        details: diffs.join("; "),
      });
      await notifyUser(userId, `⚠️ <b>Reconciliation</b>\n\n${critical.slice(0, 6).join("\n")}`);
    } else if (diffs.length) {
      await writeSystemLog({
        userId,
        level: "INFO",
        action: "RECONCILE_WORKER",
        details: diffs.join("; "),
      });
    }
    logger.info({ userId, diffs: diffs.length }, "ExchangeReconciliationWorker");
    return { ok: critical.length === 0, diffs };
  }
}

export const exchangeReconciliationWorker = new ExchangeReconciliationWorker();
