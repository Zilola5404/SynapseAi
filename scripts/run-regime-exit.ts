/**
 * Regime & exit parity. Same entries as the 24h walk. Does not retune Intelligence.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { logger } from "../server/logger.js";
import { FACTOR_KEYS } from "../server/trading/backtest/universeWalk.js";
import { EXIT_HOLD_VARIANTS } from "../server/trading/backtest/config.js";
import { computeRMetrics, fmtR } from "../server/trading/backtest/rMetrics.js";
import { runParityWalk, type WalkTrade } from "../server/trading/backtest/universeWalk.js";
import { EXIT_SELECTION_RULE, selectCanonicalExit } from "../server/trading/exitPolicy.js";

logger.level = "error";

function writeBoth(rel: string, body: string) {
  const main = path.resolve(rel);
  const copy = path.resolve("ai-docs", rel);
  fs.mkdirSync(path.dirname(main), { recursive: true });
  fs.mkdirSync(path.dirname(copy), { recursive: true });
  fs.writeFileSync(main, body);
  fs.writeFileSync(copy, body);
}

function avg(xs: number[]) {
  return xs.length ? xs.reduce((s, n) => s + n, 0) / xs.length : 0;
}

function fmtPct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function extraCols(trades: WalkTrade[]) {
  const m = computeRMetrics(trades);
  return {
    ...m,
    avgHoldH: avg(trades.map((t) => t.timeInTradeMs)) / 3600000,
    avgMfe: avg(trades.map((t) => t.mfeR)),
    avgMae: avg(trades.map((t) => t.maeR)),
    timeExits: trades.filter((t) => t.exit === "TIME").length,
    eodExits: trades.filter((t) => t.exit === "EOD").length,
    slExits: trades.filter((t) => t.exit === "SL").length,
    tpExits: trades.filter((t) => t.exit !== "TIME" && t.exit !== "EOD" && t.exit !== "SL").length,
  };
}

function metricsTable(title: string, trades: WalkTrade[]) {
  const m = extraCols(trades);
  return [
    `### ${title}`,
    "",
    `n=${m.trades}`,
    "",
    "| Metric | Value |",
    "|---|---:|",
    `| Trades | ${m.trades} |`,
    `| Expectancy R | ${fmtR(m.expectancyR)} |`,
    `| Median R | ${fmtR(m.medianR)} |`,
    `| Win rate | ${fmtPct(m.winRate)} |`,
    `| Profit factor | ${Number.isFinite(m.profitFactor) ? m.profitFactor.toFixed(2) : "n/a"} |`,
    `| Max DD R | ${fmtR(m.maxDrawdownR)} |`,
    `| Average R | ${fmtR(m.averageR)} |`,
    `| Average hold | ${m.avgHoldH.toFixed(2)} h |`,
    `| Average MFE | ${fmtR(m.avgMfe)} |`,
    `| Average MAE | ${fmtR(m.avgMae)} |`,
    `| SL / TP / TIME / EOD | ${m.slExits} / ${m.tpExits} / ${m.timeExits} / ${m.eodExits} |`,
    "",
  ].join("\n");
}

function rowLine(label: string, trades: WalkTrade[]) {
  const m = extraCols(trades);
  const pf = Number.isFinite(m.profitFactor) ? m.profitFactor.toFixed(2) : "n/a";
  return `| ${label} | ${m.trades} | ${fmtR(m.expectancyR)} | ${pf} | ${fmtR(m.maxDrawdownR)} | ${m.avgHoldH.toFixed(2)}h | ${fmtR(m.avgMfe)} | ${fmtR(m.avgMae)} | ${fmtPct(m.winRate)} |`;
}

async function main() {
  const started = new Date().toISOString();
  const run = await runParityWalk();
  const v24 = run.variants["24h"] || [];
  const allowed = extraCols(v24);
  const blocked = extraCols(run.shadows);

  const holdRows = EXIT_HOLD_VARIANTS.map((v) => {
    const trades = run.variants[v.label] || [];
    const m = extraCols(trades);
    return { label: v.label, expectancyR: m.expectancyR, maxDrawdownR: m.maxDrawdownR, trades: m.trades };
  });
  const policy = selectCanonicalExit(holdRows);

  const byRegime: Record<string, WalkTrade[]> = {};
  for (const t of v24) {
    byRegime[t.marketRegime] = byRegime[t.marketRegime] || [];
    byRegime[t.marketRegime].push(t);
  }

  const scoreBuckets: { label: string; pred: (n: number) => boolean }[] = [
    { label: "10", pred: (n) => n === 10 },
    { label: "11", pred: (n) => n === 11 },
    { label: "12", pred: (n) => n === 12 },
    { label: "13", pred: (n) => n === 13 },
    { label: "14", pred: (n) => n === 14 },
    { label: "15", pred: (n) => n >= 15 },
  ];

  const aPlus = v24.filter((t) => t.grade === "A+");
  const aOnly = v24.filter((t) => t.grade === "A");
  const missing: Record<string, number> = {};
  for (const k of FACTOR_KEYS) missing[k] = aOnly.filter((t) => !t.factors[k]).length;
  const shadowAPlus = run.shadows.filter((t) => t.grade === "A+").length;

  const wfLines: string[] = [];
  let posOos = 0;
  let negOos = 0;
  for (const w of run.windows) {
    const train = v24.filter((t) => t.t >= w.trainStart && t.t < w.trainEnd);
    const val = v24.filter((t) => t.t >= w.valStart && t.t < w.valEnd);
    const oos = v24.filter((t) => t.t >= w.oosStart && t.t < w.oosEnd);
    const tr = computeRMetrics(train);
    const va = computeRMetrics(val);
    const oo = computeRMetrics(oos);
    if (oo.trades && oo.expectancyR > 0) posOos += 1;
    if (oo.trades && oo.expectancyR <= 0) negOos += 1;
    const pf = Number.isFinite(oo.profitFactor) ? oo.profitFactor.toFixed(2) : "n/a";
    wfLines.push(
      `| ${w.id} | ${fmtR(tr.expectancyR)} (n=${tr.trades}) | ${fmtR(va.expectancyR)} (n=${va.trades}) | ${fmtR(oo.expectancyR)} (n=${oo.trades}) | ${pf} | ${fmtR(oo.maxDrawdownR)} |`
    );
  }
  const oosWindows = posOos + negOos;
  const posPct = oosWindows ? posOos / oosWindows : 0;

  const trending = byRegime.TRENDING || [];
  const highVol = byRegime.HIGH_VOLATILITY || [];
  const ranging = byRegime.RANGING || [];
  const trendM = extraCols(trending);
  const highM = extraCols(highVol);
  const regimeDependent =
    trending.length >= 30 &&
    highVol.length >= 20 &&
    trendM.expectancyR > 0 &&
    trendM.expectancyR > highM.expectancyR + 0.05;
  const overall = allowed;
  let decision: "A" | "B" | "C" = "C";
  let decisionTitle = "OPTION C — EDGE NOT CONFIRMED";
  if (overall.trades >= 30 && overall.expectancyR > 0 && posPct >= 0.6 && aPlus.length >= 30) {
    decision = "A";
    decisionTitle = "OPTION A — CURRENT STRATEGY HAS SUFFICIENT EDGE";
  } else if (regimeDependent) {
    decision = "B";
    decisionTitle = "OPTION B — EDGE IS REGIME DEPENDENT";
  }

  const exitMd = [
    "# EXIT SENSITIVITY",
    "",
    `**Run:** ${started}`,
    "**Entry policy frozen.** Same signal indices for every hold. Intelligence not changed.",
    "",
    EXIT_SELECTION_RULE.note,
    "",
    "| Hold | Trades | Expectancy R | PF | Max DD R | Avg hold | Avg MFE | Avg MAE | Win rate |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...EXIT_HOLD_VARIANTS.map((v) => rowLine(v.label, run.variants[v.label] || [])),
    "",
    `**Canonical policy:** **${policy.id}** (variant ${policy.variant})`,
    "",
    policy.reason,
    "",
    policy.variant === "B"
      ? "Backtest will use no time cap (EOD at end of series only). PAPER/TESTNET/LIVE already have no TIME_EXIT (`EXIT_POLICY.maxHoldMs = 0`)."
      : `TIME_EXIT ${policy.id} will be applied in backtest, PAPER, TESTNET, and LIVE via EXIT_POLICY.`,
    "",
    "LIVE remains disabled as a trading mode. This only aligns the exit rule if a cap is adopted.",
    "",
  ].join("\n");

  const regimeMd = [
    "# REGIME PERFORMANCE",
    "",
    `**Run:** ${started}`,
    "Source: allowed (traded) 24h-hold fills on the frozen entry set. LOW_VOLATILITY is **not** a RegimeState in Intelligence — it is not invented here.",
    "",
    "| Regime | Trades | Win rate | Expectancy R | Median R | PF | Max DD R | Average R |",
    "|---|---:|---:|---:|---:|---:|---:|---:|",
    ...["TRENDING", "HIGH_VOLATILITY", "RANGING", "EXTREME_VOLATILITY", "LOW_VOLATILITY"].map((name) => {
      const rows = byRegime[name] || [];
      const m = extraCols(rows);
      const pf = Number.isFinite(m.profitFactor) ? m.profitFactor.toFixed(2) : "n/a";
      return `| ${name} | ${m.trades} | ${fmtPct(m.winRate)} | ${fmtR(m.expectancyR)} | ${fmtR(m.medianR)} | ${pf} | ${fmtR(m.maxDrawdownR)} | ${fmtR(m.averageR)} |`;
    }),
    "",
    metricsTable("TRENDING", trending),
    metricsTable("HIGH_VOLATILITY", highVol),
    metricsTable("RANGING (executed — should be near 0; noNewTrades=true)", ranging),
    "",
  ].join("\n");

  const gateMd = [
    "# REGIME GATE VALIDATION",
    "",
    `**Run:** ${started}`,
    "Shadow = would have been A/A+ TRADE if `regime.noNewTrades` were ignored. **Not traded.** Same fill model (24h hold for this comparison).",
    "",
    "| Group | Trades | Expectancy R | PF | Max DD R | Avg hold | Avg MFE | Avg MAE | Win rate |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    rowLine("Allowed (live TRADE)", v24),
    rowLine("Blocked by regime (shadow)", run.shadows),
    "",
    `Allowed n=${allowed.trades} exp ${fmtR(allowed.expectancyR)}. Shadow n=${blocked.trades} exp ${fmtR(blocked.expectancyR)}.`,
    "",
    blocked.trades < 10
      ? "Shadow sample too small to judge the gate."
      : blocked.expectancyR < allowed.expectancyR
        ? "**REGIME FILTER = GOOD** — blocked setups have worse expectancy than allowed."
        : "**REGIME FILTER = BAD** — blocked setups look better than allowed on this sample. Do not flip the gate from one run; this is diagnostic only.",
    "",
    `Shadow A+ count: ${shadowAPlus} (executed A+ remains ${aPlus.length}).`,
    "",
  ].join("\n");

  const scoreMd = [
    "# SCORE DISTRIBUTION",
    "",
    `**Run:** ${started}`,
    "A+ threshold **not** changed. Diagnostic only.",
    "",
    "| Score | n | Expectancy R | PF | Win rate |",
    "|---:|---:|---:|---:|---:|",
    ...scoreBuckets.map((b) => {
      const rows = v24.filter((t) => b.pred(t.confluenceScore));
      const m = extraCols(rows);
      const pf = Number.isFinite(m.profitFactor) ? m.profitFactor.toFixed(2) : "n/a";
      return `| ${b.label} | ${m.trades} | ${fmtR(m.expectancyR)} | ${pf} | ${fmtPct(m.winRate)} |`;
    }),
    "",
  ].join("\n");

  const aPlusMd = [
    "# A+ DIAGNOSTICS",
    "",
    `**Run:** ${started}`,
    "",
    "A+ requires confluence **≥13 / 15**. Max parts: btc 2, h4 2, structure 2, level 2, liquidity 2, bos 2, volume 1, rr 2.",
    "Missing any two-point factor plus volume lands at 12 = grade A. Liquidity historically rarely confirms.",
    "",
    `| Executed A+ | **${aPlus.length}** |`,
    `| Executed A | ${aOnly.length} |`,
    `| Shadow A+ blocked only by regime | ${shadowAPlus} |`,
    "",
    "## Missing factors among executed A (not A+)",
    "",
    "| Factor | Missing in A trades |",
    "|---|---:|",
    ...FACTOR_KEYS.map((k) => `| ${k} | ${missing[k]} / ${aOnly.length} |`),
    "",
    "## A+ regimes (executed)",
    "",
    aPlus.length
      ? aPlus.map((t) => `- ${new Date(t.t).toISOString()} ${t.symbol} ${t.direction} score ${t.confluenceScore} regime ${t.marketRegime} result ${fmtR(t.resultR)}`).join("\n")
      : "None.",
    "",
    "## Why A+ is rare",
    "",
    "The live engine already maps only A/A+ to TRADE. Reaching 13 needs almost every confluence line ON. This is a threshold effect, not a data bug.",
    "",
  ].join("\n");

  const wfMd = [
    "# WALK-FORWARD CONSISTENCY",
    "",
    `**Run:** ${started}`,
    "Hold used for this table: **24h** (same as the previous published walk).",
    "",
    "| Window | Train R | Validation R | OOS R | OOS PF | OOS DD |",
    "|---|---:|---:|---:|---:|---:|",
    ...wfLines,
    "",
    `| Positive OOS windows | **${posOos}** |`,
    `| Negative OOS windows | **${negOos}** |`,
    `| % profitable OOS windows | **${fmtPct(posPct)}** |`,
    "",
    "A single +R OOS total can hide a losing window. Percent of profitable OOS windows is the consistency check.",
    "",
  ].join("\n");

  const decisionMd = [
    "# STRATEGY DECISION",
    "",
    `**Run:** ${started}`,
    `**Canonical exit:** ${policy.id} (variant ${policy.variant})`,
    "",
    `## ${decisionTitle}`,
    "",
    decision === "A"
      ? "Gates passed: overall expectancy R > 0, A+ sample ≥30, majority of OOS windows profitable."
      : decision === "B"
        ? `TRENDING n=${trending.length} exp ${fmtR(trendM.expectancyR)} vs HIGH_VOLATILITY n=${highVol.length} exp ${fmtR(highM.expectancyR)}. Not a universal bot. Do not retune weights here.`
        : [
            "Edge is not confirmed as a universal, deployable strategy.",
            "",
            `- Overall 24h expectancy ${fmtR(overall.expectancyR)} on ${overall.trades} trades.`,
            `- A+ executed n=${aPlus.length} (need 30).`,
            `- Profitable OOS windows: ${fmtPct(posPct)} (${posOos}/${oosWindows}).`,
            `- Exit parity: ${policy.id}.`,
            "",
            "Do not enable LIVE. Do not curve-fit weights. Next Intelligence work only after this document, using regime + exit + confluence dataset.",
          ].join("\n"),
    "",
    "**ALLOW_LIVE:** false",
    "",
  ].join("\n");

  writeBoth("reports/exit-sensitivity.md", exitMd);
  writeBoth("reports/regime-performance.md", regimeMd);
  writeBoth("reports/regime-gate-validation.md", gateMd);
  writeBoth("reports/score-distribution.md", scoreMd);
  writeBoth("reports/a-plus-diagnostics.md", aPlusMd);
  writeBoth("reports/walk-forward-consistency.md", wfMd);
  writeBoth("reports/strategy-decision.md", decisionMd);

  const ev = path.resolve("ai-docs/reports/qa_evidence");
  fs.mkdirSync(ev, { recursive: true });
  fs.writeFileSync(
    path.join(ev, "exit_sensitivity.json"),
    JSON.stringify({ started, holdRows, policy, allowed: allowed.trades, shadows: blocked.trades, decision, decisionTitle }, null, 2)
  );

  console.log(exitMd);
  console.log(decisionMd);
  console.log(`wrote regime/exit reports entries=${run.entryCount} shadows=${run.shadowCount} policy=${policy.id} decision=${decision}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack || err.message : err);
  process.exit(1);
});
