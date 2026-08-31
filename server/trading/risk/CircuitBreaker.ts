import { prisma } from "../../db.js";
import { logger } from "../../logger.js";
import { writeSystemLog } from "../../services/logService.js";

export async function tripCircuit(userId: string, reason: string, ms = 15 * 60 * 1000) {
  const until = new Date(Date.now() + ms);
  await prisma.circuitBreakerState.upsert({
    where: { userId },
    update: { status: "OPEN", reason, openedAt: new Date(), cooldownUntil: until },
    create: { userId, status: "OPEN", reason, openedAt: new Date(), cooldownUntil: until },
  });
  await writeSystemLog({
    userId,
    level: "RISK_WARN",
    action: "CIRCUIT_OPEN",
    details: `${reason} until ${until.toISOString()}`,
  });
  logger.warn({ userId, reason }, "circuit breaker OPEN");
}

export async function circuitStatus(userId: string): Promise<{ open: boolean; reason?: string }> {
  const row = await prisma.circuitBreakerState.findUnique({ where: { userId } });
  if (!row || row.status !== "OPEN") return { open: false };
  if (row.cooldownUntil && row.cooldownUntil.getTime() <= Date.now()) {
    await prisma.circuitBreakerState.update({
      where: { userId },
      data: { status: "CLOSED", reason: "" },
    });
    return { open: false };
  }
  return { open: true, reason: row.reason };
}

export async function resetCircuit(userId: string) {
  await prisma.circuitBreakerState.upsert({
    where: { userId },
    update: { status: "CLOSED", reason: "", cooldownUntil: null },
    create: { userId, status: "CLOSED" },
  });
}
