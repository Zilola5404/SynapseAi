export type SoakTrade = {
  symbol: string;
  pnl: number;
  fees: number;
  sizeUsdt: number;
  entryPrice: number;
  exitPrice: number | null;
  reason: string | null;
  isPaper: boolean;
  closedAt: Date | null;
};

export type SoakPosition = {
  symbol: string;
  status: string;
  closeRequestedAt: Date | null;
  isPaper: boolean;
};

export type PaperSoakReport = {
  targetMin: number;
  targetMax: number;
  closed: number;
  open: number;
  stuckClosing: number;
  duplicateSymbols: string[];
  slCloses: number;
  tpCloses: number;
  otherCloses: number;
  wins: number;
  losses: number;
  net: number;
  fees: number;
  avgSize: number;
  avgFee: number;
  avgSlPct: number;
  feeShareOfLoss: number;
  canReopenAfterClose: boolean;
  readyForTestnet: boolean;
  blockers: string[];
};

const STUCK_MS = 60_000;

export function summarizePaperSoak(params: {
  trades: SoakTrade[];
  positions: SoakPosition[];
  targetMin?: number;
  targetMax?: number;
}): PaperSoakReport {
  const targetMin = params.targetMin ?? 10;
  const targetMax = params.targetMax ?? 20;
  const paperTrades = params.trades.filter((t) => t.isPaper);
  const paperPos = params.positions.filter((p) => p.isPaper);
  const now = Date.now();

  const open = paperPos.filter((p) => p.status === "OPEN" || p.status === "CLOSING");
  const stuckClosing = paperPos.filter(
    (p) => p.status === "CLOSING" && p.closeRequestedAt && now - p.closeRequestedAt.getTime() > STUCK_MS
  ).length;

  const bySymbol = new Map<string, number>();
  for (const p of open) {
    bySymbol.set(p.symbol, (bySymbol.get(p.symbol) || 0) + 1);
  }
  const duplicateSymbols = [...bySymbol.entries()].filter(([, n]) => n > 1).map(([s]) => s);

  const slCloses = paperTrades.filter((t) => t.reason === "STOP_LOSS").length;
  const tpCloses = paperTrades.filter((t) => t.reason === "TAKE_PROFIT").length;
  const otherCloses = paperTrades.length - slCloses - tpCloses;
  const wins = paperTrades.filter((t) => t.pnl > 0).length;
  const losses = paperTrades.filter((t) => t.pnl < 0);
  const net = paperTrades.reduce((s, t) => s + t.pnl, 0);
  const fees = paperTrades.reduce((s, t) => s + (t.fees || 0), 0);
  const avgSize = paperTrades.length ? paperTrades.reduce((s, t) => s + t.sizeUsdt, 0) / paperTrades.length : 0;
  const avgFee = paperTrades.length ? fees / paperTrades.length : 0;

  const slMoves = paperTrades.filter((t) => t.reason === "STOP_LOSS" && t.entryPrice > 0 && t.exitPrice);
  const avgSlPct = slMoves.length
    ? slMoves.reduce((s, t) => s + (Math.abs((t.exitPrice as number) - t.entryPrice) / t.entryPrice) * 100, 0) /
      slMoves.length
    : 0;

  const lossAbs = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const feeShareOfLoss = lossAbs > 0 ? fees / lossAbs : 0;

  const closedSymbols = new Set(paperTrades.map((t) => t.symbol));
  const openSymbols = new Set(open.map((p) => p.symbol));
  const canReopenAfterClose =
    paperTrades.length === 0 || [...closedSymbols].some((s) => !openSymbols.has(s)) || open.length === 0;

  const blockers: string[] = [];
  if (paperTrades.length < targetMin) blockers.push("need_more_trades");
  if (stuckClosing > 0) blockers.push("stuck_closing");
  if (duplicateSymbols.length) blockers.push("duplicates");
  if (!canReopenAfterClose && paperTrades.length > 0 && open.length > 0 && closedSymbols.size === openSymbols.size) {
    /* still ok if some closed symbols are free */
  }
  if (stuckClosing > 0 || duplicateSymbols.length) {
    /* blockers already set */
  }

  const readyForTestnet =
    paperTrades.length >= targetMin &&
    stuckClosing === 0 &&
    duplicateSymbols.length === 0 &&
    (slCloses > 0 || tpCloses > 0 || paperTrades.length >= targetMin);

  return {
    targetMin,
    targetMax,
    closed: paperTrades.length,
    open: open.length,
    stuckClosing,
    duplicateSymbols,
    slCloses,
    tpCloses,
    otherCloses,
    wins,
    losses: losses.length,
    net,
    fees,
    avgSize,
    avgFee,
    avgSlPct,
    feeShareOfLoss,
    canReopenAfterClose,
    readyForTestnet,
    blockers,
  };
}
