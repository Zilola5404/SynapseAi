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
  pnlConsistent: boolean;
  feesConsistent: boolean;
  readyForTestnet: boolean;
  blockers: string[];
};

const STUCK_MS = 60_000;

export function reopenAfterClosePassed(trades: SoakTrade[], positions: SoakPosition[]) {
  const paperTrades = trades.filter((t) => t.isPaper);
  const paperPos = positions.filter((p) => p.isPaper);
  const closedBySymbol = new Map<string, number>();
  for (const t of paperTrades) {
    closedBySymbol.set(t.symbol, (closedBySymbol.get(t.symbol) || 0) + 1);
  }
  if ([...closedBySymbol.values()].some((n) => n >= 2)) return true;
  const openNow = paperPos.filter((p) => p.status === "OPEN" || p.status === "CLOSING");
  return [...closedBySymbol.entries()].some(([symbol, n]) => n >= 1 && openNow.some((p) => p.symbol === symbol));
}

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

  const canReopenAfterClose = reopenAfterClosePassed(paperTrades, paperPos);
  const pnlConsistent = paperTrades.length > 0 && paperTrades.every((t) => Number.isFinite(t.pnl));
  const feesConsistent =
    paperTrades.length > 0 &&
    paperTrades.every((t) => (t.fees || 0) > 0 && t.sizeUsdt > 0 && t.fees >= t.sizeUsdt * 0.0007);

  const blockers: string[] = [];
  if (paperTrades.length < targetMin) blockers.push("need_more_trades");
  if (slCloses < 1) blockers.push("need_stop_loss");
  if (tpCloses < 1) blockers.push("need_take_profit");
  if (stuckClosing > 0) blockers.push("stuck_closing");
  if (duplicateSymbols.length) blockers.push("duplicates");
  if (!canReopenAfterClose) blockers.push("need_reopen");
  if (!pnlConsistent) blockers.push("pnl_inconsistent");
  if (!feesConsistent) blockers.push("fees_inconsistent");

  const readyForTestnet = blockers.length === 0;

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
    pnlConsistent,
    feesConsistent,
    readyForTestnet,
    blockers,
  };
}
