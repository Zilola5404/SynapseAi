import { INTEL } from "../intelligence/config.js";

export type ClusterTrade = {
  symbol: string;
  side: string;
  pnl: number;
  regime?: string;
};

export function nextUtcMidnight(from = new Date()) {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + 1, 0, 0, 0, 0));
}

export function detectLossCluster(rows: ClusterTrade[], limit = INTEL.lossClusterCount) {
  if (rows.length < limit) return null;
  const slice = rows.slice(0, limit);
  if (slice.some((r) => r.pnl >= 0)) return null;
  const symbol = slice[0].symbol;
  const side = slice[0].side;
  if (!slice.every((r) => r.symbol === symbol && r.side === side)) return null;
  const regimes = slice.map((r) => r.regime || "").filter(Boolean);
  const sameRegime = regimes.length === 0 || regimes.every((r) => r === regimes[0]);
  if (!sameRegime) return null;
  return {
    symbol,
    side,
    regime: regimes[0] || "",
    count: slice.length,
  };
}
