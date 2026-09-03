import { toSnapshot } from "../../market/TechnicalAnalysis.js";
import { loadFundingCached, loadKlinesCached } from "../../market/klinesPaged.js";
import { logger } from "../../logger.js";
import {
  decisionToSignal,
  evaluateIntelligence,
} from "../intelligence/TradingIntelligenceEngine.js";
import { SCAN_UNIVERSE } from "../intelligence/config.js";
import type { BinanceCandle } from "../../binance.js";
import { BACKTEST, DAY_MS, EXIT_HOLD_VARIANTS, INTERVAL_MS } from "./config.js";
import { simulateFill, type ExitReason, type FundingPoint } from "./fillModel.js";
import { closedWindow, indexRangeForTime, rollingWalkForwardWindows, type WalkWindow } from "./mtf.js";
import { classifyVeto, shadowSignalFromIntel, wouldTradeWithoutRegime } from "./shadowSignal.js";
import type { StrategySignal } from "../types.js";

export const FACTOR_KEYS = ["btc", "h4", "structure", "level", "liquidity", "bos", "volume", "rr"] as const;
export type FactorKey = (typeof FACTOR_KEYS)[number];

export type WalkTrade = {
  symbol: string;
  t: number;
  grade: "A+" | "A" | "B" | string;
  direction: "LONG" | "SHORT";
  pnl: number;
  fees: number;
  funding: number;
  rMultiple: number;
  resultR: number;
  exit: ExitReason;
  bucket: "train" | "validation" | "oos";
  windowId: number;
  factors: Record<string, boolean>;
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number | null;
  exitPrice: number;
  timeInTradeMs: number;
  maeR: number;
  mfeR: number;
  ambiguousSlTpBar: boolean;
  tpHits: number;
  confluenceScore: number;
  marketRegime: string;
  btcContext: string;
  h4Trend: string;
  rr: number;
};

export type FeatureRow = {
  timestamp: number;
  symbol: string;
  marketRegime: string;
  btcContext: string;
  h4Trend: string;
  structure: boolean;
  level: boolean;
  liquidity: boolean;
  bos: boolean;
  volume: boolean;
  rr: number;
  confluenceScore: number;
  grade: string;
  direction: string;
  resultR: number;
};

export type StoredEntry = {
  symbol: string;
  index: number;
  t: number;
  signal: StrategySignal;
  kind: "allowed" | "regime_shadow";
  grade: string;
  confluenceScore: number;
  marketRegime: string;
  btcContext: string;
  h4Trend: string;
  factors: Record<string, boolean>;
  rr: number;
};

export type WalkCollector = {
  entries: StoredEntry[];
  shadows: StoredEntry[];
};

export type BarEvent = {
  t: number;
  outcome: "snapshot_skip" | "rejected" | "signal" | "fill_reject" | "opened";
  reason?: string;
};

export type WindowDiag = {
  windowId: number;
  bucket: WalkTrade["bucket"];
  windowStart: string;
  windowEnd: string;
  symbol: string;
  candlesLoaded: number;
  candlesProcessed: number;
  snapshotSkip: number;
  signalsGenerated: number;
  signalsRejected: number;
  fillRejected: number;
  tradesOpened: number;
  tradesClosed: number;
  rejectReasons: Record<string, number>;
};

export type SymbolPack = {
  symbol: string;
  d1: BinanceCandle[];
  h4: BinanceCandle[];
  h1: BinanceCandle[];
  m15: BinanceCandle[];
  m5: BinanceCandle[];
  btcD1: BinanceCandle[];
  btcH4: BinanceCandle[];
  btcH1: BinanceCandle[];
  funding: FundingPoint[];
};

function emptyDiag(partial: Omit<WindowDiag, "rejectReasons"> & { rejectReasons?: Record<string, number> }): WindowDiag {
  return { ...partial, rejectReasons: partial.rejectReasons || {} };
}

function bump(map: Record<string, number>, key: string) {
  map[key] = (map[key] || 0) + 1;
}

export async function loadSymbolPack(
  symbol: string,
  startMs: number,
  endMs: number,
  btc?: Pick<SymbolPack, "btcD1" | "btcH4" | "btcH1">
): Promise<SymbolPack> {
  const d1Start = startMs - 400 * DAY_MS;
  const extra = (interval: string) => startMs - BACKTEST.lookback * (INTERVAL_MS[interval] || INTERVAL_MS["5m"]);
  const [d1, h4, h1, m15, m5, funding] = await Promise.all([
    loadKlinesCached(symbol, "1d", d1Start, endMs),
    loadKlinesCached(symbol, "4h", extra("4h"), endMs),
    loadKlinesCached(symbol, "1h", extra("1h"), endMs),
    loadKlinesCached(symbol, "15m", extra("15m"), endMs),
    loadKlinesCached(symbol, "5m", extra("5m"), endMs),
    loadFundingCached(symbol, startMs - DAY_MS, endMs),
  ]);
  const btcD1 = symbol === "BTCUSDT" ? d1 : btc?.btcD1 || [];
  const btcH4 = symbol === "BTCUSDT" ? h4 : btc?.btcH4 || [];
  const btcH1 = symbol === "BTCUSDT" ? h1 : btc?.btcH1 || [];
  return { symbol, d1, h4, h1, m15, m5, btcD1, btcH4, btcH1, funding };
}

export async function loadBtcContext(startMs: number, endMs: number) {
  const d1Start = startMs - 400 * DAY_MS;
  const extra = (interval: string) => startMs - BACKTEST.lookback * (INTERVAL_MS[interval] || INTERVAL_MS["1h"]);
  const [btcD1, btcH4, btcH1] = await Promise.all([
    loadKlinesCached("BTCUSDT", "1d", d1Start, endMs),
    loadKlinesCached("BTCUSDT", "4h", extra("4h"), endMs),
    loadKlinesCached("BTCUSDT", "1h", extra("1h"), endMs),
  ]);
  return { btcD1, btcH4, btcH1 };
}

export function walkSlice(
  pack: SymbolPack,
  startIndex: number,
  endIndex: number,
  bucket: WalkTrade["bucket"],
  step = BACKTEST.step,
  windowId = 0,
  diag?: WindowDiag,
  events?: BarEvent[],
  collector?: WalkCollector
): WalkTrade[] {
  const trades: WalkTrade[] = [];
  const reasons = diag?.rejectReasons || {};
  const lookback = BACKTEST.lookback;
  for (let i = startIndex; i < endIndex && i < pack.m5.length - 1; ) {
    const t = pack.m5[i].closeTime || pack.m5[i].openTime;
    if (diag) diag.candlesProcessed += 1;
    if ((i - startIndex) % (step * 800) === 0) {
      console.error(`[backtest] ${pack.symbol} ${new Date(t).toISOString()}`);
    }
    const slice = {
      d1: closedWindow(pack.d1, t, lookback),
      h4: closedWindow(pack.h4, t, lookback),
      h1: closedWindow(pack.h1, t, lookback),
      m15: closedWindow(pack.m15, t, lookback),
      m5: closedWindow(pack.m5, t, lookback),
    };
    const h1 = toSnapshot(pack.symbol, slice.h1, "1H");
    const m15 = toSnapshot(pack.symbol, slice.m15, "15M");
    const m5 = toSnapshot(pack.symbol, slice.m5, "5M");
    if (!h1 || !m15 || !m5) {
      if (diag) diag.snapshotSkip += 1;
      events?.push({ t, outcome: "snapshot_skip" });
      i += step;
      continue;
    }
    const intel = evaluateIntelligence({
      symbol: pack.symbol,
      snapshots: {
        d1: toSnapshot(pack.symbol, slice.d1, "1D"),
        h4: toSnapshot(pack.symbol, slice.h4, "4H"),
        h1,
        m15,
        m5,
      },
      candles: slice,
      btc: {
        d1: toSnapshot("BTCUSDT", closedWindow(pack.btcD1, t, lookback), "1D"),
        h4: toSnapshot("BTCUSDT", closedWindow(pack.btcH4, t, lookback), "4H"),
        h1: toSnapshot("BTCUSDT", closedWindow(pack.btcH1, t, lookback), "1H"),
      },
    });
    const decision = decisionToSignal(intel);
    const signal = decision.signal;
    if (!signal) {
      if (diag) diag.signalsRejected += 1;
      const veto = intel.vetoes[0] || decision.vetoes[0];
      const reason = veto ? classifyVeto(veto.textEn, veto.textRu) : "NO_SIGNAL";
      bump(reasons, reason);
      events?.push({ t, outcome: "rejected", reason });
      if (collector && wouldTradeWithoutRegime(intel)) {
        const shadow = shadowSignalFromIntel({
          symbol: pack.symbol,
          intel,
          h1,
          m5,
          candles: slice,
        });
        if (shadow) {
          const factors: Record<string, boolean> = {};
          for (const line of shadow.scoreLines || []) factors[line.key] = Boolean(line.ok);
          collector.shadows.push({
            symbol: pack.symbol,
            index: i,
            t,
            signal: shadow,
            kind: "regime_shadow",
            grade: shadow.setupGrade || intel.confluence.grade,
            confluenceScore: intel.confluence.total,
            marketRegime: intel.regime.regime,
            btcContext: intel.context.marketMode,
            h4Trend: intel.context.btcTrend4H,
            factors,
            rr: shadow.riskReward,
          });
        }
      }
      i += step;
      continue;
    }
    if (diag) diag.signalsGenerated += 1;
    events?.push({ t, outcome: "signal" });
    const fill = simulateFill(pack.m5, i, signal, pack.funding);
    if (!fill) {
      if (diag) diag.fillRejected += 1;
      bump(reasons, "FILL_REJECTED");
      events?.push({ t, outcome: "fill_reject", reason: "FILL_REJECTED" });
      i += step;
      continue;
    }
    const factors: Record<string, boolean> = {};
    for (const line of signal.scoreLines || []) {
      factors[line.key] = Boolean(line.ok);
    }
    if (diag) {
      diag.tradesOpened += 1;
      diag.tradesClosed += 1;
    }
    events?.push({ t, outcome: "opened" });
    collector?.entries.push({
      symbol: pack.symbol,
      index: i,
      t,
      signal,
      kind: "allowed",
      grade: signal.setupGrade || "A",
      confluenceScore: signal.confluenceScore || signal.qualityScore,
      marketRegime: intel.regime.regime,
      btcContext: intel.context.marketMode,
      h4Trend: intel.context.btcTrend4H,
      factors,
      rr: signal.riskReward,
    });
    trades.push({
      symbol: pack.symbol,
      t,
      grade: signal.setupGrade || "A",
      direction: signal.direction,
      pnl: fill.pnl,
      fees: fill.fees,
      funding: fill.funding,
      rMultiple: fill.resultR,
      resultR: fill.resultR,
      exit: fill.exitReason,
      bucket,
      windowId,
      factors,
      entry: fill.entry,
      sl: fill.sl,
      tp1: fill.tp1,
      tp2: fill.tp2,
      tp3: fill.tp3,
      exitPrice: fill.exit,
      timeInTradeMs: fill.timeInTradeMs,
      maeR: fill.maeR,
      mfeR: fill.mfeR,
      ambiguousSlTpBar: fill.ambiguousSlTpBar,
      tpHits: fill.tpHits,
      confluenceScore: signal.confluenceScore || signal.qualityScore,
      marketRegime: intel.regime.regime,
      btcContext: intel.context.marketMode,
      h4Trend: intel.context.btcTrend4H,
      rr: signal.riskReward,
    });
    i = Math.max(i + step, fill.exitIndex + 1);
  }
  if (diag) diag.rejectReasons = reasons;
  return trades;
}

export function featureFromTrade(t: WalkTrade): FeatureRow {
  return {
    timestamp: t.t,
    symbol: t.symbol,
    marketRegime: t.marketRegime,
    btcContext: t.btcContext,
    h4Trend: t.h4Trend,
    structure: Boolean(t.factors.structure),
    level: Boolean(t.factors.level),
    liquidity: Boolean(t.factors.liquidity),
    bos: Boolean(t.factors.bos),
    volume: Boolean(t.factors.volume),
    rr: t.rr,
    confluenceScore: t.confluenceScore,
    grade: t.grade,
    direction: t.direction,
    resultR: t.resultR,
  };
}

function inRange(t: number, start: number, end: number) {
  return t >= start && t < end;
}

function tagTrade(trade: WalkTrade, windows: WalkWindow[]): WalkTrade {
  if (!windows.length) return trade;
  for (const w of windows) {
    if (inRange(trade.t, w.oosStart, w.oosEnd)) return { ...trade, bucket: "oos", windowId: w.id };
  }
  for (const w of windows) {
    if (inRange(trade.t, w.valStart, w.valEnd)) return { ...trade, bucket: "validation", windowId: w.id };
  }
  for (const w of windows) {
    if (inRange(trade.t, w.trainStart, w.trainEnd)) return { ...trade, bucket: "train", windowId: w.id };
  }
  return trade;
}

function diagFromEvents(
  pack: SymbolPack,
  w: WalkWindow,
  bucket: WalkTrade["bucket"],
  start: number,
  end: number,
  events: BarEvent[],
  trades: WalkTrade[]
): WindowDiag {
  const slice = events.filter((e) => inRange(e.t, start, end));
  const reasons: Record<string, number> = {};
  for (const e of slice) {
    if (e.outcome === "rejected" && e.reason) bump(reasons, e.reason);
  }
  const opened = trades.filter((t) => inRange(t.t, start, end)).length;
  return emptyDiag({
    windowId: w.id,
    bucket,
    windowStart: new Date(start).toISOString(),
    windowEnd: new Date(end).toISOString(),
    symbol: pack.symbol,
    candlesLoaded: pack.m5.length,
    candlesProcessed: slice.length,
    snapshotSkip: slice.filter((e) => e.outcome === "snapshot_skip").length,
    signalsGenerated: slice.filter((e) => e.outcome === "signal" || e.outcome === "opened" || e.outcome === "fill_reject").length,
    signalsRejected: slice.filter((e) => e.outcome === "rejected").length,
    fillRejected: slice.filter((e) => e.outcome === "fill_reject").length,
    tradesOpened: opened,
    tradesClosed: opened,
    rejectReasons: reasons,
  });
}

export function walkPackWindows(pack: SymbolPack, windows: WalkWindow[], step = BACKTEST.step, collector?: WalkCollector) {
  const usable = indexRangeForTime(
    pack.m5,
    windows[0]?.trainStart || pack.m5[0]?.openTime || 0,
    windows[windows.length - 1]?.oosEnd || pack.m5[pack.m5.length - 1]?.closeTime || 0
  );
  const events: BarEvent[] = [];
  const raw =
    usable.start >= 0 && usable.end > usable.start
      ? walkSlice(pack, usable.start, usable.end + 1, "train", step, 0, undefined, events, collector)
      : [];
  const trades = raw.map((t) => tagTrade(t, windows));
  const diags: WindowDiag[] = [];
  for (const w of windows) {
    const buckets: Array<{ bucket: WalkTrade["bucket"]; start: number; end: number }> = [
      { bucket: "train", start: w.trainStart, end: w.trainEnd },
      { bucket: "validation", start: w.valStart, end: w.valEnd },
      { bucket: "oos", start: w.oosStart, end: w.oosEnd },
    ];
    for (const b of buckets) {
      diags.push(diagFromEvents(pack, w, b.bucket, b.start, b.end, events, trades));
    }
  }
  return { trades, diags };
}

/** Legacy 50/25/25 on available 5m body — used only if walk-forward cannot fit. */
export function walkPack(pack: SymbolPack, step = BACKTEST.step): WalkTrade[] {
  const start = Math.min(BACKTEST.lookback, Math.max(80, pack.m5.length - 40));
  if (pack.m5.length < start + 40) return [];
  const n = pack.m5.length - start;
  const trainEnd = start + Math.floor(n * 0.5);
  const valEnd = start + Math.floor(n * 0.75);
  return [
    ...walkSlice(pack, start, trainEnd, "train", step, 0),
    ...walkSlice(pack, trainEnd, valEnd, "validation", step, 0),
    ...walkSlice(pack, valEnd, pack.m5.length, "oos", step, 0),
  ];
}

export async function runUniverseWalk(
  symbols: readonly string[] = SCAN_UNIVERSE,
  step = BACKTEST.step,
  months = BACKTEST.historyMonths
) {
  logger.level = "error";
  const endMs = Date.now();
  const startMs = endMs - months * 30.4375 * DAY_MS;
  const btc = await loadBtcContext(startMs, endMs);
  const all: WalkTrade[] = [];
  const diags: WindowDiag[] = [];
  const perSymbol: Record<string, number> = {};
  const loaded: Record<string, { m5: number; first: string; last: string; funding: number }> = {};
  let windows: WalkWindow[] = [];

  for (const symbol of symbols) {
    const pack = await loadSymbolPack(symbol, startMs, endMs, symbol === "BTCUSDT" ? undefined : btc);
    const first = pack.m5[0]?.openTime || startMs;
    const last = pack.m5[pack.m5.length - 1]?.closeTime || endMs;
    loaded[symbol] = {
      m5: pack.m5.length,
      first: new Date(first).toISOString(),
      last: new Date(last).toISOString(),
      funding: pack.funding.length,
    };
    if (!windows.length) {
      const usableStart = first + BACKTEST.lookback * INTERVAL_MS["5m"];
      windows = rollingWalkForwardWindows(usableStart, last, BACKTEST);
    }
    const walked = windows.length
      ? walkPackWindows(pack, windows, step)
      : { trades: walkPack(pack, step), diags: [] as WindowDiag[] };
    perSymbol[symbol] = walked.trades.length;
    all.push(...walked.trades);
    diags.push(...walked.diags);
  }

  const historyDays = Math.min(
    ...Object.values(loaded).map((row) => {
      const a = Date.parse(row.first);
      const b = Date.parse(row.last);
      return (b - a) / DAY_MS;
    })
  );

  return {
    trades: all,
    diags,
    perSymbol,
    loaded,
    windows,
    step,
    months,
    historyDays,
    startMs,
    endMs,
    noFutureData: true,
    split: windows.length
      ? `rolling walk-forward train ${BACKTEST.trainDays}d / val ${BACKTEST.valDays}d / oos ${BACKTEST.oosDays}d shift ${BACKTEST.shiftDays}d`
      : "fallback 50/25/25 — history too short for 6/2/2 walk-forward",
    fundingIncluded: Object.values(loaded).some((r) => r.funding > 0),
  };
}

function tradeFromStored(e: StoredEntry, fill: NonNullable<ReturnType<typeof simulateFill>>): WalkTrade {
  return {
    symbol: e.symbol,
    t: e.t,
    grade: e.grade,
    direction: e.signal.direction,
    pnl: fill.pnl,
    fees: fill.fees,
    funding: fill.funding,
    rMultiple: fill.resultR,
    resultR: fill.resultR,
    exit: fill.exitReason,
    bucket: "train",
    windowId: 0,
    factors: e.factors,
    entry: fill.entry,
    sl: fill.sl,
    tp1: fill.tp1,
    tp2: fill.tp2,
    tp3: fill.tp3,
    exitPrice: fill.exit,
    timeInTradeMs: fill.timeInTradeMs,
    maeR: fill.maeR,
    mfeR: fill.mfeR,
    ambiguousSlTpBar: fill.ambiguousSlTpBar,
    tpHits: fill.tpHits,
    confluenceScore: e.confluenceScore,
    marketRegime: e.marketRegime,
    btcContext: e.btcContext,
    h4Trend: e.h4Trend,
    rr: e.rr,
  };
}

export async function runParityWalk(
  symbols: readonly string[] = SCAN_UNIVERSE,
  step = BACKTEST.step,
  months = BACKTEST.historyMonths
) {
  logger.level = "error";
  const endMs = Date.now();
  const startMs = endMs - months * 30.4375 * DAY_MS;
  const btc = await loadBtcContext(startMs, endMs);
  const variants: Record<string, WalkTrade[]> = {};
  for (const v of EXIT_HOLD_VARIANTS) variants[v.label] = [];
  const shadow24: WalkTrade[] = [];
  const diags: WindowDiag[] = [];
  const loaded: Record<string, { m5: number; first: string; last: string; funding: number }> = {};
  let windows: WalkWindow[] = [];
  let entryCount = 0;
  let shadowCount = 0;

  for (const symbol of symbols) {
    const pack = await loadSymbolPack(symbol, startMs, endMs, symbol === "BTCUSDT" ? undefined : btc);
    const first = pack.m5[0]?.openTime || startMs;
    const last = pack.m5[pack.m5.length - 1]?.closeTime || endMs;
    loaded[symbol] = {
      m5: pack.m5.length,
      first: new Date(first).toISOString(),
      last: new Date(last).toISOString(),
      funding: pack.funding.length,
    };
    if (!windows.length) {
      const usableStart = first + BACKTEST.lookback * INTERVAL_MS["5m"];
      windows = rollingWalkForwardWindows(usableStart, last, BACKTEST);
    }
    const collector: WalkCollector = { entries: [], shadows: [] };
    const walked = windows.length
      ? walkPackWindows(pack, windows, step, collector)
      : { trades: walkPack(pack, step), diags: [] as WindowDiag[] };
    diags.push(...walked.diags);
    entryCount += collector.entries.length;
    shadowCount += collector.shadows.length;
    for (const v of EXIT_HOLD_VARIANTS) {
      for (const e of collector.entries) {
        const fill = simulateFill(pack.m5, e.index, e.signal, pack.funding, v.bars);
        if (!fill) continue;
        variants[v.label].push(tagTrade(tradeFromStored(e, fill), windows));
      }
    }
    for (const e of collector.shadows) {
      const fill = simulateFill(pack.m5, e.index, e.signal, pack.funding, 288);
      if (!fill) continue;
      shadow24.push(tagTrade(tradeFromStored(e, fill), windows));
    }
  }

  const historyDays = Math.min(
    ...Object.values(loaded).map((row) => {
      const a = Date.parse(row.first);
      const b = Date.parse(row.last);
      return (b - a) / DAY_MS;
    })
  );

  return {
    variants,
    shadows: shadow24,
    windows,
    diags,
    loaded,
    historyDays,
    entryCount,
    shadowCount,
    months,
    step,
  };
}
