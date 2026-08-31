const locks = new Map<string, number>();

export function lockKey(userId: string, symbol: string) {
  return `${userId}:${symbol.replace("/", "").toUpperCase()}`;
}

export async function withSymbolLock<T>(userId: string, symbol: string, fn: () => Promise<T>): Promise<T> {
  const key = lockKey(userId, symbol);
  if (locks.has(key)) {
    throw new Error(`По ${symbol} уже идёт операция. Подождите.`);
  }
  locks.set(key, Date.now());
  try {
    return await fn();
  } finally {
    locks.delete(key);
  }
}

export function isLocked(userId: string, symbol: string) {
  return locks.has(lockKey(userId, symbol));
}
