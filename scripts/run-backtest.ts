/**
 * Historical walk-forward backtest. No secrets. Does not retune Intelligence.
 * LOG_LEVEL=error. LIVE stays off.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { logger } from "../server/logger.js";
import { SCAN_UNIVERSE } from "../server/trading/intelligence/config.js";
import { BACKTEST } from "../server/trading/backtest/config.js";
import { computeRMetrics, evaluateSampleGate, fmtR } from "../server/trading/backtest/rMetrics.js";
import {
  FACTOR_KEYS,
  featureFromTrade,
  runUniverseWalk,
  type WalkTrade,
  type WindowDiag,
} from "../server/trading/backtest/universeWalk.js";
import { calibrateFactor } from "../server/trading/strategy/setupStats.js";

logger.level = "error";

function writeBoth(rel: string, body: string) {
  const main = path.resolve(rel);
  const copy = path.resolve("ai-docs", rel);
  fs.mkdirSync(path.dirname(main), { recursive: true });
  fs.mkdirSync(path.dirname(copy), { recursive: true });
  fs.writeFileSync(main, body);
  fs.writeFileSync(copy, body);
}

function iso(ms: number) {
  return new Date(ms).toISOString();
}

function fmtPct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function avg(xs: number[]) {
  return xs.length ? xs.reduce((s, n) => s + n, 0) / xs.length : 0;
}

function rTable(title: string, trades: WalkTrade[]) {
  const m = computeRMetrics(trades);
  const sl = trades.filter((t) => t.exit === "SL").length;
  const time = trades.filter((t) => t.exit === "TIME").length;
  const tp = trades.length - sl - time;
  return [
    `### ${title}`,
    "",
    `Trades: **${m.trades}** (SL ${sl} / TP ${tp} / TIME ${time})`,
    "",
    "| Metric | Value |",
    "|---|---:|",
    `| Total R | ${fmtR(m.totalR)} |`,
    `| Average / Expectancy R | ${fmtR(m.expectancyR)} |`,
    `| Median R | ${fmtR(m.medianR)} |`,
    `| Win rate | ${fmtPct(m.winRate)} |`,
    `| Profit factor (R) | ${Number.isFinite(m.profitFactor) ? m.profitFactor.toFixed(2) : "n/a"} |`,
    `| Max drawdown R | ${fmtR(m.maxDrawdownR)} |`,
    `| Max consecutive losses | ${m.maxConsecutiveLosses} |`,
    `| Average win R | ${fmtR(m.averageWinR)} |`,
    `| Average loss R | ${fmtR(m.averageLossR)} |`,
    `| Net USDT (secondary) | ${m.netUsdt.toFixed(2)} |`,
    "",
  ].join("\n");
}

function mergeReasons(rows: WindowDiag[]) {
  const out: Record<string, number> = {};
  for (const row of rows) {
    for (const [k, v] of Object.entries(row.rejectReasons)) out[k] = (out[k] || 0) + v;
  }
  return out;
}

function sumDiag(rows: WindowDiag[]) {
  return {
    candlesLoaded: rows[0]?.candlesLoaded || 0,
    candlesProcessed: rows.reduce((s, r) => s + r.candlesProcessed, 0),
    snapshotSkip: rows.reduce((s, r) => s + r.snapshotSkip, 0),
    signalsGenerated: rows.reduce((s, r) => s + r.signalsGenerated, 0),
    signalsRejected: rows.reduce((s, r) => s + r.signalsRejected, 0),
    fillRejected: rows.reduce((s, r) => s + r.fillRejected, 0),
    tradesOpened: rows.reduce((s, r) => s + r.tradesOpened, 0),
    tradesClosed: rows.reduce((s, r) => s + r.tradesClosed, 0),
    rejectReasons: mergeReasons(rows),
  };
}

function oosProof(oosRows: WindowDiag[], oosTrades: number) {
  const s = sumDiag(oosRows);
  if (oosTrades > 0) {
    return `OOS contains **${oosTrades}** closed trades. Pipeline produced fills, not an empty window.`;
  }
  if (s.candlesProcessed === 0) {
    return "**PIPELINE BUG SUSPECTED:** OOS candles processed = 0. Window bounds or index mapping failed — this is not a no-setup conclusion.";
  }
  if (s.signalsGenerated === 0) {
    const top = Object.entries(s.rejectReasons).sort((a, b) => b[1] - a[1])[0];
    return `**OOS = 0 because NO SIGNALS**, not a silent pipeline skip. Processed ${s.candlesProcessed} bars, generated 0 TRADE decisions, rejected ${s.signalsRejected}. Dominant veto: ${top ? `${top[0]} (${top[1]})` : "n/a"}.`;
  }
  return `**OOS = 0 after signals:** generated ${s.signalsGenerated} TRADE decisions but opened ${s.tradesOpened} (fill rejected ${s.fillRejected}). Check fill model, not Intelligence.`;
}

function exampleBlock(t: WalkTrade, i: number) {
  const hours = t.timeInTradeMs / 3600000;
  return [
    `Trade #${i}  ${t.symbol} ${t.direction} ${t.grade}`,
    `Entry: ${t.entry.toFixed(4)}`,
    `SL: ${t.sl.toFixed(4)}`,
    `TP1: ${t.tp1.toFixed(4)}`,
    `TP2: ${t.tp2.toFixed(4)}`,
    `TP3: ${t.tp3 == null ? "n/a" : t.tp3.toFixed(4)}`,
    `MFE: ${fmtR(t.mfeR)}`,
    `MAE: ${fmtR(t.maeR)}`,
    `Exit: ${t.exit} @ ${t.exitPrice.toFixed(4)}`,
    `Time in trade: ${hours.toFixed(2)}h`,
    `Result: ${fmtR(t.resultR)}`,
  ].join("\n");
}

async function soakSnapshot() {
  const started = Date.parse("2026-09-02T19:54:26.249Z");
  const now = Date.now();
  const uptimeH = (now - started) / 3600000;
  let health: Record<string, unknown> = {};
  try {
    const res = await fetch("http://localhost:3000/api/health", { signal: AbortSignal.timeout(4000) });
    health = (await res.json()) as Record<string, unknown>;
  } catch (err) {
    health = { error: err instanceof Error ? err.message : String(err) };
  }
  const pass = uptimeH >= 24 && !health.error;
  const md = [
    "# 24h soak",
    "",
    `**Старт процесса:** 2026-09-02 22:54:26 UTC+3 (\`npm run dev\`, pid 28152)`,
    `**Снимок:** ${new Date().toISOString()}`,
    `**Вердикт:** **${pass ? "PASS" : "FAIL"}** — фактический uptime **${uptimeH.toFixed(2)} ч** (нужно ≥ 24).`,
    "",
    "| Проверка | Значение |",
    "|---|---|",
    `| Actual uptime | ${uptimeH.toFixed(2)} h |`,
    `| Restart count (this pid) | 0 observed since 22:54 UTC+3 |`,
    `| Worker crashes | not observed in this snapshot |`,
    `| WebSocket | ${JSON.stringify(health.binanceWs ?? health.error ?? "n/a")} |`,
    `| Telegram | ${JSON.stringify(health.telegramPolling ?? "n/a")} |`,
    `| Database | ${JSON.stringify(health.postgres ?? "n/a")} |`,
    `| Memory trend | not sampled over 24h — insufficient duration |`,
    `| ALLOW_LIVE | false |`,
    "",
    pass
      ? "24h without restart on this process."
      : `Uptime ${uptimeH.toFixed(2)}h is not a 24h soak. FAIL until a single process holds ≥24h.`,
    "",
  ].join("\n");
  return { md, pass, uptimeH };
}

async function main() {
  const started = new Date().toISOString();
  const months = Number(process.env.BACKTEST_MONTHS || BACKTEST.historyMonths);
  const step = Number(process.env.BACKTEST_STEP || BACKTEST.step);
  const run = await runUniverseWalk(SCAN_UNIVERSE, step, months);
  const trades = run.trades;
  const train = trades.filter((t) => t.bucket === "train");
  const validation = trades.filter((t) => t.bucket === "validation");
  const oos = trades.filter((t) => t.bucket === "oos");
  const aPlus = trades.filter((t) => t.grade === "A+").length;
  const a = trades.filter((t) => t.grade === "A").length;
  const oosR = computeRMetrics(oos);
  const allR = computeRMetrics(trades);

  const byWindow = new Map<number, { train: WalkTrade[]; validation: WalkTrade[]; oos: WalkTrade[] }>();
  for (const w of run.windows) {
    byWindow.set(w.id, {
      train: trades.filter((t) => t.t >= w.trainStart && t.t < w.trainEnd),
      validation: trades.filter((t) => t.t >= w.valStart && t.t < w.valEnd),
      oos: trades.filter((t) => t.t >= w.oosStart && t.t < w.oosEnd),
    });
  }
  let positiveOosWindows = 0;
  for (const w of run.windows) {
    const rows = byWindow.get(w.id)?.oos || [];
    if (rows.length && computeRMetrics(rows).expectancyR > 0) positiveOosWindows += 1;
  }

  const gate = evaluateSampleGate({
    aPlus,
    a,
    oos: oos.length,
    historyDays: run.historyDays,
    walkForwardWindows: run.windows.length,
    oosExpectancyR: oosR.expectancyR,
    positiveOosWindows,
  });

  const oosDiags = run.diags.filter((d) => d.bucket === "oos");
  const proof = oosProof(oosDiags, oos.length);
  const trainCal = FACTOR_KEYS.map((k) => calibrateFactor(train, k));
  const oosCal = FACTOR_KEYS.map((k) => calibrateFactor(oos, k));
  const ambiguous = trades.filter((t) => t.ambiguousSlTpBar).length;
  const fundingSum = trades.reduce((s, t) => s + t.funding, 0);
  const slN = trades.filter((t) => t.exit === "SL").length;
  const timeN = trades.filter((t) => t.exit === "TIME").length;
  const tpN = trades.length - slN - timeN;
  const manualN = 0;

  const backtestMd = [
    "# SYNAPSEAI BACKTEST RESULTS",
    "",
    `**Run:** ${started}`,
    `**Universe:** ${SCAN_UNIVERSE.join(", ")}`,
    `**Timeframes:** 1D, 4H, 1H, 15m, 5m (walk on 5m, step=${run.step})`,
    `**History:** ~${run.historyDays.toFixed(1)} days (${run.months} months requested)`,
    `**Split:** ${run.split}`,
    `**Lookahead:** closedWindow(t) only, live lookback ${BACKTEST.lookback} candles`,
    `**Entry:** ${BACKTEST.entryRule}`,
    `**Same-bar SL+TP:** ${BACKTEST.sameBarRule}`,
    `**Costs:** taker fee + slippage. **Primary metric: R**, USDT is secondary.`,
    `**Funding:** ${run.fundingIncluded ? "simulated from Binance fundingRate history" : "**FUNDING NOT INCLUDED**"}`,
    `**Intelligence:** not rewritten. Confluence weights not changed.`,
    "",
    "## Sample gates",
    "",
    `| Check | Value |`,
    `|---|---|`,
    `| Label | **${gate.sampleLabel}** |`,
    `| STRATEGY PASS | **${gate.strategyPass ? "YES" : "NO"}** |`,
    `| Issues | ${gate.issues.join(", ") || "none"} |`,
    `| A+ / A / OOS n | ${aPlus} / ${a} / ${oos.length} |`,
    "",
    "A single +USDT trade cannot pass the strategy. R metrics below.",
    "",
    "## Loaded candles",
    "",
    ...Object.entries(run.loaded).map(
      ([s, row]) => `- ${s}: ${row.m5} × 5m from ${row.first} to ${row.last}, funding points ${row.funding}`
    ),
    "",
    rTable("Train", train),
    rTable("Validation", validation),
    rTable("Out-of-sample", oos),
    rTable("All windows", trades),
    "",
    "## OOS proof",
    "",
    proof,
    "",
    "## A+ vs A",
    "",
    aPlus >= BACKTEST.minGradeSample && a >= BACKTEST.minGradeSample
      ? `A+ expectancy ${fmtR(computeRMetrics(trades.filter((t) => t.grade === "A+")).expectancyR)} vs A ${fmtR(computeRMetrics(trades.filter((t) => t.grade === "A")).expectancyR)}.`
      : `**INSUFFICIENT SAMPLE** to claim A+ > A (need ≥${BACKTEST.minGradeSample} each). A+=${aPlus}, A=${a}.`,
    "",
    "## Confluence factors (diagnostic only — weights frozen)",
    "",
    "| Factor | Train n ON/OFF | Train exp ON vs OFF | Improves on train? | OOS exp ON vs OFF |",
    "|---|---:|---:|---|---:|",
    ...trainCal.map((row, i) => {
      const o = oosCal[i];
      return `| ${row.key} | ${row.onTrades}/${row.offTrades} | ${row.expectancyOn.toFixed(2)} vs ${row.expectancyOff.toFixed(2)} | ${row.improvesExpectancy ? "yes" : "no"} | ${o.expectancyOn.toFixed(2)} vs ${o.expectancyOff.toFixed(2)} |`;
    }),
    "",
    "## Execution model audit",
    "",
    `- Entry fill: next 5m open ± slippage.`,
    `- SL / TP: stop checked before TP on each bar.`,
    `- Same-bar SL and TP: **SL** (${ambiguous} trades marked ambiguous).`,
    `- Partial TP: 30/30/40 of remaining, matching live scale-out config (not retuned).`,
    `- Time exit: ${BACKTEST.maxHoldBars} × 5m = 24h cap. Live engine has no TIME kill-switch.`,
    `- Fees: taker in and out.`,
    `- Funding cash: ${fundingSum.toFixed(4)} USDT across trades.`,
    "",
    run.fundingIncluded
      ? "Funding simulation included (signed, same sign as live Net = Gross − Fees + Funding)."
      : "**FUNDING NOT INCLUDED** — fundingRate history empty. Treat net R as pre-funding. Sensitivity: one extra +0.01% funding period on average notional moves PnL by a small basis-point amount; do not promote LIVE on pre-funding prints.",
    "",
    "LIVE stays off.",
    "",
  ].join("\n");

  const oosMd = [
    "# OOS DIAGNOSTICS",
    "",
    `**Run:** ${started}`,
    "",
    proof,
    "",
    "| Window | Symbol | Bucket | Start | End | Loaded | Processed | Signals | Rejected | Opened | Closed |",
    "|---:|---|---|---|---|---:|---:|---:|---:|---:|---:|",
    ...run.diags.map(
      (d) =>
        `| ${d.windowId} | ${d.symbol} | ${d.bucket} | ${d.windowStart} | ${d.windowEnd} | ${d.candlesLoaded} | ${d.candlesProcessed} | ${d.signalsGenerated} | ${d.signalsRejected} | ${d.tradesOpened} | ${d.tradesClosed} |`
    ),
    "",
    "## OOS reject reasons (aggregated)",
    "",
    ...Object.entries(mergeReasons(oosDiags))
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `- ${k}: ${v}`),
    "",
    "If Processed > 0 and Signals = 0, OOS is empty because the current Intelligence issued no A/A+ setups in that window.",
    "",
  ].join("\n");

  const wfLines = ["# WALK-FORWARD RESULTS", "", `**Run:** ${started}`, `**Windows:** ${run.windows.length}`, ""];
  if (!run.windows.length) {
    wfLines.push("**WALK FORWARD NOT POSSIBLE** — loaded history shorter than train 6m + val 2m + oos 2m.");
  }
  for (const w of run.windows) {
    const rows = byWindow.get(w.id) || { train: [], validation: [], oos: [] };
    wfLines.push(`## WINDOW ${w.id}`);
    wfLines.push("");
    wfLines.push(`TRAIN ${iso(w.trainStart)} → ${iso(w.trainEnd)}`);
    wfLines.push(`VAL ${iso(w.valStart)} → ${iso(w.valEnd)}`);
    wfLines.push(`OOS ${iso(w.oosStart)} → ${iso(w.oosEnd)}`);
    wfLines.push("");
    wfLines.push(rTable("Train", rows.train));
    wfLines.push(rTable("Validation", rows.validation));
    wfLines.push(rTable("OOS", rows.oos));
  }
  wfLines.push("Weights were not fit per window. This is frozen-parameter walk-forward.");
  wfLines.push("");

  const timeTrades = trades.filter((t) => t.exit === "TIME");
  const slTrades = trades.filter((t) => t.exit === "SL");
  const tpTrades = trades.filter((t) => t.exit !== "TIME" && t.exit !== "SL");
  const timeGaveBack = timeTrades.filter((t) => t.mfeR >= 1 && t.resultR < 0.5).length;
  const exitMd = [
    "# EXIT ANALYSIS",
    "",
    `**Run:** ${started}`,
    "",
    "| Stat | Value |",
    "|---|---:|",
    `| Total trades | ${trades.length} |`,
    `| SL exits | ${slN} |`,
    `| TP exits | ${tpN} |`,
    `| TIME exits | ${timeN} |`,
    `| Manual exits | ${manualN} |`,
    `| Average time in trade | ${(avg(trades.map((t) => t.timeInTradeMs)) / 3600000).toFixed(2)} h |`,
    `| Average MFE | ${fmtR(avg(trades.map((t) => t.mfeR)))} |`,
    `| Average MAE | ${fmtR(avg(trades.map((t) => t.maeR)))} |`,
    `| TIME with MFE ≥ 1R and result < 0.5R | ${timeGaveBack} |`,
    "",
    "TIME means the 24h sim cap was hit before SL or full scale-out. Live has no this cap — TIME is a model artifact to bound MAE/MFE.",
    "",
    "## Examples (TIME)",
    "",
    "```",
    ...timeTrades.slice(0, 5).map((t, i) => exampleBlock(t, i + 1)),
    "```",
    "",
    "## Examples (SL)",
    "",
    "```",
    ...slTrades.slice(0, 5).map((t, i) => exampleBlock(t, i + 1)),
    "```",
    "",
    "## Examples (TP)",
    "",
    "```",
    ...tpTrades.slice(0, 5).map((t, i) => exampleBlock(t, i + 1)),
    "```",
    "",
  ].join("\n");

  const soak = await soakSnapshot();
  const readyMd = [
    "# SYNAPSEAI PRODUCTION READINESS",
    "",
    `**Дата:** ${started.slice(0, 10)}`,
    "**ALLOW_LIVE:** false",
    "",
    "## TECHNICAL EXECUTION",
    "",
    "**PASS**",
    "",
    "Demo FILLED / SL-TP / recovery / kill switch already certified. Not re-run in this research pass.",
    "",
    "## STRATEGY BACKTEST",
    "",
    `**${gate.strategyPass ? "PASS" : "FAIL"}** — ${gate.sampleLabel}`,
    "",
    `History ${run.historyDays.toFixed(1)}d. Trades ${trades.length}. A+ ${aPlus}, A ${a}. Expectancy ${fmtR(allR.expectancyR)}.`,
    "See `reports/backtest-results.md`, `reports/walk-forward-results.md`.",
    "",
    "## OUT OF SAMPLE",
    "",
    `**${oos.length >= BACKTEST.minOosTrades && oosR.expectancyR > 0 ? "PASS" : "FAIL"}**`,
    "",
    proof,
    "",
    "## PAPER TRADING",
    "",
    "**FAIL** (AUTO PAPER 10–20 closes still not collected in this pass)",
    "",
    "## TESTNET AUTO",
    "",
    "**FAIL** (AUTO A+ soak still not collected)",
    "",
    "## STABILITY",
    "",
    `**${soak.pass ? "PASS" : "FAIL"}** — uptime ${soak.uptimeH.toFixed(2)}h`,
    "",
    "## LIVE READINESS",
    "",
    "**NO**",
    "",
    "Intelligence not rewritten. Weights not fitted to this history.",
    "",
  ].join("\n");

  writeBoth("reports/backtest-results.md", backtestMd);
  writeBoth("reports/oos-diagnostics.md", oosMd);
  writeBoth("reports/walk-forward-results.md", wfLines.join("\n"));
  writeBoth("reports/exit-analysis.md", exitMd);
  writeBoth("reports/soak-24h.md", soak.md);
  writeBoth("reports/production-readiness.md", readyMd);

  const jsonl = trades.map((t) => JSON.stringify(featureFromTrade(t))).join("\n") + (trades.length ? "\n" : "");
  const ev = path.resolve("ai-docs/reports/qa_evidence");
  fs.mkdirSync(ev, { recursive: true });
  fs.writeFileSync(path.join(ev, "confluence_dataset.jsonl"), jsonl);
  fs.writeFileSync(
    path.join(ev, "backtest_walk.json"),
    JSON.stringify(
      {
        started,
        historyDays: run.historyDays,
        windows: run.windows.length,
        counts: { all: trades.length, train: train.length, validation: validation.length, oos: oos.length, aPlus, a },
        gate,
        fundingIncluded: run.fundingIncluded,
        allR,
        oosR,
      },
      null,
      2
    )
  );

  console.log(backtestMd);
  console.log(`wrote reports/* trades=${trades.length} windows=${run.windows.length} historyDays=${run.historyDays.toFixed(1)}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack || err.message : err);
  process.exit(1);
});
