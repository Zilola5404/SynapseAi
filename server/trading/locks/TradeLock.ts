import { createHash } from "node:crypto";
import { prisma } from "../../db.js";

const memory = new Map<string, number>();

export function lockKey(userId: string, symbol: string) {
  return `${userId}:${symbol.replace("/", "").toUpperCase()}`;
}

function advisoryId(key: string) {
  return createHash("sha256").update(key).digest().readInt32BE(0);
}

export async function withSymbolLock<T>(userId: string, symbol: string, fn: () => Promise<T>): Promise<T> {
  const key = lockKey(userId, symbol);
  if (memory.has(key)) {
    throw new Error(`По ${symbol} уже идёт операция. Подождите.`);
  }
  memory.set(key, Date.now());
  const id = advisoryId(`LOCK:${userId}:${symbol.replace("/", "").toUpperCase()}`);
  let pg = false;
  try {
    try {
      const rows = await prisma.$queryRawUnsafe<Array<{ ok: boolean }>>(
        `SELECT pg_try_advisory_lock($1) AS ok`,
        id
      );
      pg = Boolean(rows?.[0]?.ok);
      if (!pg) throw new Error(`По ${symbol} уже идёт операция. Подождите.`);
    } catch (err) {
      if (err instanceof Error && /уже идёт операция/.test(err.message)) throw err;
    }
    return await fn();
  } finally {
    if (pg) {
      await prisma.$queryRawUnsafe(`SELECT pg_advisory_unlock($1)`, id).catch(() => undefined);
    }
    memory.delete(key);
  }
}

export function isLocked(userId: string, symbol: string) {
  return memory.has(lockKey(userId, symbol));
}
