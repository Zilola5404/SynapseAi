export type DepthBook = {
  symbol: string;
  bids: [number, number][];
  asks: [number, number][];
  imbalance: number;
  timestamp: number;
};

export function computeImbalance(bids: [number, number][], asks: [number, number][]): number {
  const bidVol = bids.reduce((acc, [p, q]) => acc + p * q, 0);
  const askVol = asks.reduce((acc, [p, q]) => acc + p * q, 0);
  const total = bidVol + askVol;
  return total > 0 ? Math.round(((bidVol - askVol) / total) * 100) : 0;
}
