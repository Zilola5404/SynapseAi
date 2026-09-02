export type PositionSnapshot = {
  status?: string;
  quantity?: number;
  entryPrice?: number;
  side?: string;
};

export function formatPositionMismatch(params: {
  userId: string;
  symbol: string;
  expected: PositionSnapshot;
  actual: PositionSnapshot;
  at?: Date;
}) {
  return [
    "⚠️ POSITION MISMATCH",
    `user=${params.userId.slice(0, 8)}`,
    `symbol=${params.symbol}`,
    `expected=${JSON.stringify(params.expected)}`,
    `actual=${JSON.stringify(params.actual)}`,
    `ts=${(params.at || new Date()).toISOString()}`,
  ].join(" ");
}
