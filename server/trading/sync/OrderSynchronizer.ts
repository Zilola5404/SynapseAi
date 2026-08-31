import { prisma } from "../../db.js";
import { logger } from "../../logger.js";
import { writeSystemLog } from "../../services/logService.js";
import { findByClientOrderId, transitionOrder, type OrderState } from "../execution/orderState.js";

const STREAM_TO_STATE: Record<string, OrderState> = {
  NEW: "ACKNOWLEDGED",
  PARTIALLY_FILLED: "PARTIALLY_FILLED",
  FILLED: "FILLED",
  CANCELED: "CANCELLED",
  CANCELLED: "CANCELLED",
  EXPIRED: "CANCELLED",
  REJECTED: "REJECTED",
};

export async function syncOrderFromExchange(params: {
  clientOrderId?: string;
  exchangeOrderId?: string;
  status: string;
  executedQty?: number;
  avgPrice?: number;
  reason?: string;
  raw?: unknown;
}) {
  const cid = (params.clientOrderId || "").trim();
  if (!cid) return null;
  const row = await findByClientOrderId(cid);
  if (!row) return null;
  const to = STREAM_TO_STATE[params.status] || "UNKNOWN";
  const updated = await transitionOrder(row.id, to, {
    exchangeOrderId: params.exchangeOrderId,
    executedQty: params.executedQty,
    avgFillPrice: params.avgPrice,
    reason: params.reason || `stream ${params.status}`,
    exchangeResponse: params.raw,
  });
  logger.info({ cid, to }, "order synchronizer");
  return updated;
}

export async function markOrdersCancelled(positionId: string, reason: string) {
  const rows = await prisma.exchangeOrder.findMany({
    where: { positionId, status: { notIn: ["CLOSED", "CANCELLED", "FAILED"] } },
  });
  for (const row of rows) {
    await transitionOrder(row.id, row.purpose === "ENTRY" || row.purpose === "CLOSE" ? "CLOSED" : "CANCELLED", {
      reason,
    }).catch(() => undefined);
  }
  await writeSystemLog({
    level: "TRADE",
    action: "ORDERS_SYNC_CANCEL",
    details: `${positionId} ${reason}`,
  });
}
