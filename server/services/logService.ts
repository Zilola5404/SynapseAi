import { prisma } from "../db.js";

export async function writeSystemLog(params: {
  userId?: string | null;
  level: "INFO" | "SIGNAL" | "TRADE" | "RISK_WARN" | "ERROR";
  pair?: string;
  action: string;
  details: string;
  reasoning?: string;
  confidence?: number;
}) {
  return prisma.systemLog.create({
    data: {
      userId: params.userId || null,
      level: params.level,
      pair: params.pair || "SYSTEM",
      action: params.action,
      details: params.details,
      reasoning: params.reasoning || "",
      confidence: params.confidence,
    },
  });
}

export async function listUserLogs(userId: string, take = 30) {
  return prisma.systemLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });
}
