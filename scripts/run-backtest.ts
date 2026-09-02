/**
 * Historical walk-forward backtest. No secrets. LOG_LEVEL=error recommended.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { logger } from "../server/logger.js";
import { SCAN_UNIVERSE } from "../server/trading/intelligence/config.js";
import { FACTOR_KEYS, runUniverseWalk, type WalkTrade } from "../server/trading/backtest/universeWalk.js";
import { calibrateFactor, summarizeStrategyValidation } from "../server/trading/strategy/setupStats.js";

logger.level = "error";

function fmtPct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function bucket(trades: WalkTrade[], name: WalkTrade["bucket"]) {
  return trades.filter((t) => t.bucket === name);
}

function mdStats(title: string, trades: WalkTrade[]) {
  const g = summarizeStrategyValidation(trades);
  const sl = trades.filter((t) => t.exit === "SL").length;
  const tp = trades.filter((t) => t.exit === "TP").length;
  const lines = [
    `### ${title}`,
    "",
    `Trades: **${trades.length}** (SL ${sl} / TP ${tp} / time ${trades.length - sl - tp})`,
    "",
    "| Grade | Trades | Win rate | PF | Expectancy | Avg R | Max DD | Net |",
    "|---|---:|---:|---:|---:|---:|---:|---:|",
  ];
  for (const row of [g["A+"], g.A, g.B]) {
    lines.push(
      `| ${row.grade} | ${row.trades} | ${fmtPct(row.winRate)} | ${Number.isFinite(row.profitFactor) ? row.profitFactor.toFixed(2) : "n/a"} | ${row.expectancy.toFixed(2)} | ${row.averageR.toFixed(2)} | ${row.maxDrawdown.toFixed(2)} | ${row.netPnl.toFixed(2)} |`
    );
  }
  return lines.join("\n");
}

async function main() {
  const started = new Date().toISOString();
  const { trades, perSymbol, step, split } = await runUniverseWalk(SCAN_UNIVERSE, 6);
  const train = bucket(trades, "train");
  const validation = bucket(trades, "validation");
  const oos = bucket(trades, "oos");
  const allGrades = summarizeStrategyValidation(trades);
  const oosGrades = summarizeStrategyValidation(oos);
  const trainCal = FACTOR_KEYS.map((k) => calibrateFactor(train, k));
  const oosCal = FACTOR_KEYS.map((k) => calibrateFactor(oos, k));

  const aPlusOk = allGrades["A+"].trades >= 30;
  const aOk = allGrades.A.trades >= 30;
  const aPlusBetter =
    aPlusOk &&
    aOk &&
    allGrades["A+"].expectancy > allGrades.A.expectancy &&
    allGrades["A+"].profitFactor > allGrades.A.profitFactor;

  const md = [
    "# SYNAPSEAI BACKTEST RESULTS",
    "",
    `**Run:** ${started}`,
    `**Universe:** ${SCAN_UNIVERSE.join(", ")}`,
    `**Timeframes:** 1D, 4H, 1H, 15m, 5m (walk on 5m, step=${step})`,
    `**Split:** ${split} — parameters frozen, no retune after OOS`,
    `**Lookahead:** candlesAtOrBefore(t) only`,
    `**Costs:** taker fee + slippage in fill sim`,
    `**Funding:** not simulated in backtest (applied on live Testnet closes)`,
    "",
    "## Per symbol trade counts",
    "",
    ...Object.entries(perSymbol).map(([s, n]) => `- ${s}: ${n}`),
    "",
    mdStats("Train (50%)", train),
    "",
    mdStats("Validation (25%)", validation),
    "",
    mdStats("Out-of-sample (25%)", oos),
    "",
    mdStats("All windows", trades),
    "",
    "## A+ vs A (all windows)",
    "",
    aPlusBetter
      ? "A+ shows higher expectancy and profit factor than A on this sample."
      : "**A+ is not automatically better than A.** This sample does not support that claim (need ≥30 closed A+ and ≥30 A, plus better expectancy/PF).",
    "",
    `A+ trades: ${allGrades["A+"].trades}. A trades: ${allGrades.A.trades}. B executed: ${allGrades.B.trades} (B is NO TRADE in live engine).`,
    "",
    "## Confluence calibration (train vs OOS)",
    "",
    "Weights were **not** changed. Table is diagnostic only.",
    "",
    "| Factor | Train n ON/OFF | Train exp ON vs OFF | Improves on train? | OOS exp ON vs OFF |",
    "|---|---:|---:|---|---:|",
    ...trainCal.map((row, i) => {
      const o = oosCal[i];
      return `| ${row.key} | ${row.onTrades}/${row.offTrades} | ${row.expectancyOn.toFixed(2)} vs ${row.expectancyOff.toFixed(2)} | ${row.improvesExpectancy ? "yes" : "no"} | ${o.expectancyOn.toFixed(2)} vs ${o.expectancyOff.toFixed(2)} |`;
    }),
    "",
    "## Flags",
    "",
    `- OOS expectancy > 0: **${oos.reduce((s, t) => s + t.pnl, 0) / Math.max(1, oos.length) > 0 ? "YES" : "NO"}**`,
    `- Sample A+/A ≥30 each: **${aPlusOk && aOk ? "YES" : "NO"}**`,
    `- A+ statistically preferred on this run: **${aPlusBetter ? "YES" : "NO"}**`,
    "",
    "This is research, not a profit guarantee. LIVE stays off.",
    "",
  ].join("\n");

  const jsonPath = path.resolve("ai-docs/reports/qa_evidence/backtest_walk.json");
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        started,
        perSymbol,
        counts: {
          all: trades.length,
          train: train.length,
          validation: validation.length,
          oos: oos.length,
          aPlus: allGrades["A+"].trades,
          a: allGrades.A.trades,
        },
        oos: oosGrades,
        all: allGrades,
        trainCalibration: trainCal,
        aPlusBetter,
      },
      null,
      2
    )
  );
  fs.writeFileSync(path.resolve("reports/backtest-results.md"), md);
  fs.writeFileSync(path.resolve("ai-docs/reports/backtest-results.md"), md);
  console.log(md);
  console.log(`wrote reports/backtest-results.md trades=${trades.length}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
