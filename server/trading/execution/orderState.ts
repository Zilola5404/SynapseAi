import { prisma } from "../../db.js";
import { logger } from "../../logger.js";
import { writeSystemLog } from "../../services/logService.js";

export const ORDER_STATES = [
  "NEW",
  "VALIDATED",
  "RISK_APPROVED",
  "SUBMITTED",
  "ACKNOWLEDGED",
  "PARTIALLY_FILLED",
  "FILLED",
  "PROTECTION_PENDING",
  "PROTECTED",
  "CLOSED",
  "REJECTED",
  "FAILED",
  "CANCELLED",
  "UNKNOWN",
] as const;

export type OrderState = (typeof ORDER_STATES)[number];

const ALLOWED: Record<string, OrderState[]> = {
  NEW: ["VALIDATED", "REJECTED", "FAILED", "CANCELLED"],
  VALIDATED: ["RISK_APPROVED", "REJECTED", "FAILED"],
  RISK_APPROVED: ["SUBMITTED", "REJECTED", "FAILED"],
  SUBMITTED: ["ACKNOWLEDGED", "PARTIALLY_FILLED", "FILLED", "FAILED", "CANCELLED", "UNKNOWN"],
  ACKNOWLEDGED: ["PARTIALLY_FILLED", "FILLED", "FAILED", "CANCELLED", "UNKNOWN", "PROTECTED"],
  PARTIALLY_FILLED: ["FILLED", "CANCELLED", "FAILED"],
  FILLED: ["PROTECTION_PENDING", "PROTECTED", "CLOSED"],
  PROTECTION_PENDING: ["PROTECTED", "FAILED"],
  PROTECTED: ["CLOSED", "CANCELLED"],
  CLOSED: [],
  REJECTED: [],
  FAILED: [],
  CANCELLED: [],
  UNKNOWN: ["SUBMITTED", "FILLED", "CANCELLED", "FAILED", "UNKNOWN"],
};

export function canTransition(from: string, to: OrderState): boolean {
  if (from === to) return true;
  return (ALLOWED[from] || []).includes(to);
}

export function makeClientOrderId(purpose: string): string {
  const p = purpose.slice(0, 3).toUpperCase();
  const n = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `S${p}${n}`.slice(0, 36);
}

export async function createTrackedOrder(params: {
  userId: string;
  positionId?: string;
  symbol: string;
  side: string;
  type: string;
  purpose: string;
  quantity: number;
  price?: number;
  status?: OrderState;
}) {
  const clientOrderId = makeClientOrderId(params.purpose);
  const row = await prisma.exchangeOrder.create({
    data: {
      userId: params.userId,
      positionId: params.positionId,
      symbol: params.symbol,
      side: params.side,
      type: params.type,
      purpose: params.purpose,
      status: params.status || "NEW",
      clientOrderId,
      quantity: params.quantity,
      price: params.price,
    },
  });
  await writeSystemLog({
    userId: params.userId,
    level: "TRADE",
    pair: params.symbol,
    action: `ORDER_${row.status}`,
    details: `${params.purpose} ${params.side} ${params.type} cid=${clientOrderId}`,
  });
  return row;
}

export async function transitionOrder(
  id: string,
  to: OrderState,
  extra?: {
    exchangeOrderId?: string;
    executedQty?: number;
    avgFillPrice?: number;
    feesUsdt?: number;
    lastError?: string;
    reason?: string;
    exchangeResponse?: unknown;
  }
) {
  const current = await prisma.exchangeOrder.findUnique({ where: { id } });
  if (!current) return null;
  if (!canTransition(current.status, to)) {
    logger.warn({ from: current.status, to, id }, "illegal order transition ignored");
    return current;
  }
  const response = extra?.exchangeResponse
    ? typeof extra.exchangeResponse === "string"
      ? extra.exchangeResponse
      : JSON.stringify(extra.exchangeResponse)
    : extra?.lastError || "";
  const updated = await prisma.exchangeOrder.update({
    where: { id },
    data: {
      status: to,
      exchangeOrderId: extra?.exchangeOrderId ?? current.exchangeOrderId,
      executedQty: extra?.executedQty ?? current.executedQty,
      avgFillPrice: extra?.avgFillPrice ?? current.avgFillPrice,
      feesUsdt: extra?.feesUsdt ?? current.feesUsdt,
      lastError: extra?.lastError ?? current.lastError,
    },
  });
  await prisma.orderTransition.create({
    data: {
      exchangeOrderId: current.id,
      clientOrderId: current.clientOrderId,
      symbol: current.symbol,
      fromStatus: current.status,
      toStatus: to,
      reason: extra?.reason || extra?.lastError || to,
      exchangeResponse: response.slice(0, 4000),
    },
  }).catch((err) => logger.warn({ err }, "order transition log failed"));
  await writeSystemLog({
    userId: current.userId,
    level: to === "FAILED" || to === "REJECTED" ? "ERROR" : "TRADE",
    pair: current.symbol,
    action: `ORDER_${to}`,
    details: `cid=${current.clientOrderId} xid=${updated.exchangeOrderId || "-"} ${extra?.reason || extra?.lastError || ""}`,
  });
  return updated;
}

export async function findByClientOrderId(clientOrderId: string) {
  return prisma.exchangeOrder.findUnique({ where: { clientOrderId } });
}
