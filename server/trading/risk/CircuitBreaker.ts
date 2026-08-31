const tripped = new Map<string, { until: number; reason: string }>();

export function tripCircuit(userId: string, reason: string, ms = 15 * 60 * 1000) {
  tripped.set(userId, { until: Date.now() + ms, reason });
}

export function circuitStatus(userId: string): { open: boolean; reason?: string } {
  const row = tripped.get(userId);
  if (!row) return { open: false };
  if (Date.now() > row.until) {
    tripped.delete(userId);
    return { open: false };
  }
  return { open: true, reason: row.reason };
}
