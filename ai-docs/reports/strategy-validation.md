# SYNAPSEAI STRATEGY VALIDATION

**Canonical.** Supersedes the 15-day snapshot archived at `reports/strategy-validation-legacy.md`.

**Walk:** 18 months public USD-M klines, 2025-03-02 → 2026-09-02 (~549.6 days)  
**Universe:** BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, XRPUSDT, ADAUSDT  
**Intelligence / confluence weights:** not changed in this pass  
**LIVE:** `ALLOW_LIVE=false`

Sources (do not mix numbers without reading the hold note):

| File | What it is |
|---|---|
| `reports/backtest-results.md` | 18-month walk-forward (run 2026-09-02). **Used a 24h TIME cap** at that date. |
| `reports/walk-forward-results.md` | Per-window Train / Val / OOS (same 24h walk). |
| `reports/exit-sensitivity.md` | Same entries, five holds. Chose canonical exit. |
| `reports/regime-performance.md` | Regime split (24h hold, frozen entries). |
| `reports/regime-gate-validation.md` | Allowed vs regime-blocked shadow. |
| `reports/score-distribution.md` | Confluence score vs R. A+ threshold **not** moved. |
| `reports/walk-forward-consistency.md` | Window table + OOS consistency. |
| `reports/strategy-decision.md` | Decision gate. |
| `reports/testnet-certification.md` | Infrastructure only. Not strategy edge. |

---

## Decision

**OPTION B — EDGE IS REGIME DEPENDENT.**

This is not a universal profitable strategy. It can print in some regimes/windows and fail badly in others. **Not a LIVE go. Paper AUTO 20–30 is not started.**

---

## Canonical Exit Policy

One rule for backtest default, PAPER, TESTNET AUTO, LIVE:

**`EXIT_POLICY` = NO_TIME_EXIT** (`maxHoldMs = 0`, `maxHoldBars = 1_000_000`).

Code: `server/trading/exitPolicy.ts`. Live monitor only fires TIME_EXIT if `maxHoldMs > 0`. Backtest `simulateFill` defaults to the same cap.

Pre-declared selection (not “pick the best of five”): adopt a finite cap only if it beats NO_TIME_EXIT by **>+0.05R expectancy AND better max DD**. Then take the shortest such cap.

| Hold | n | Expectancy R | PF | Max DD R |
|---|---:|---:|---:|---:|
| NO_TIME_EXIT | 138 | −0.023R | 0.96 | −18.650R |
| 12h | 138 | −0.050R | 0.87 | −12.549R |
| 24h | 138 | −0.013R | 0.97 | −11.906R |
| 48h | 138 | −0.037R | 0.93 | −15.864R |
| 72h | 138 | −0.058R | 0.89 | −17.942R |

24h is slightly better in R and DD, but the lift is **+0.010R**, not >0.05R → **keep live parity: no time kill.**

---

## 18-month sample (published walk, 24h TIME)

| Check | Value |
|---|---|
| Label | **INSUFFICIENT_SAMPLE** |
| STRATEGY PASS | **NO** |
| A+ / A / OOS n | **3 / 138 / 63** |

A+ n=3. The report is correct: **do not claim A+ is the most profitable grade.** Do not lower the confluence threshold to manufacture more A+.

### Aggregate R (same walk)

| Split | n | Expectancy R | PF |
|---|---:|---:|---:|
| Train | 59 | **−0.097R** | 0.82 |
| Validation | 19 | **−0.264R** | 0.50 |
| OOS | 63 | **+0.122R** | 1.35 |

Train and validation are negative. OOS is positive in aggregate. That is **unstable**, not a confirmed edge.

---

## Walk-forward consistency (24h hold)

| Window | Train R | Validation R | OOS R | OOS PF | OOS DD |
|---|---:|---:|---:|---:|---:|
| 1 | −0.080R (n=56) | −0.264R (n=19) | +0.092R (n=8) | 1.31 | −1.063R |
| 2 | −0.073R (n=67) | +0.092R (n=8) | +0.302R (n=12) | 1.75 | −2.107R |
| 3 | −0.131R (n=61) | +0.302R (n=12) | **−0.442R (n=14)** | **0.18** | −6.264R |
| 4 | −0.017R (n=39) | −0.442R (n=14) | **+0.398R (n=10)** | **4.25** | −1.017R |
| 5 | −0.081R (n=33) | +0.398R (n=10) | +0.290R (n=19) | 1.91 | −3.643R |

| Positive OOS windows | **4** |
| Negative OOS windows | **1** |
| Median OOS expectancy | **+0.290R** |
| Worst OOS | **Window 3, −0.442R, PF 0.18, win rate 7.1%, 11 consecutive losses** |
| Best OOS | **Window 4, +0.398R, PF 4.25** |

Window 3 is a regime-stress example, not a rounding error.

---

## Regime performance (frozen entries, 24h hold)

| Regime | Trades | Expectancy | PF | Win rate |
|---|---:|---:|---:|---:|
| TRENDING | 87 | **+0.068R** | 1.17 | 48.3% |
| HIGH_VOLATILITY | 51 | **−0.151R** | 0.71 | 33.3% |
| RANGING | 0 | — | — | — (live `noNewTrades`) |
| LOW_VOLATILITY | 0 | — | — | — (not a live RegimeState) |

TRENDING median is still **negative** (−0.145R). Weak positive mean, not a robust TRENDING bot.

---

## Regime filter shadow test

OOS diagnostics vetoes included REGIME 45005 — a large block. Shadow of **would-be A/A+ if `regime.noNewTrades` were ignored**:

| Group | n | Expectancy R | PF |
|---|---:|---:|---:|
| Allowed (traded) | 138 | −0.013R | 0.97 |
| Blocked by regime (shadow) | 135 | **+0.276R** | 2.15 |

**REGIME FILTER = BAD on this sample** — blocked setups look better than allowed. Do **not** expand `noNewTrades` (e.g. to HIGH_VOLATILITY) from this one diagnostic. Do not flip the gate without a new pre-declared test.

---

## Score distribution (A+ threshold frozen)

Executed A/A+ only. Scores 8–9 are **not traded** (grade B / NO_TRADE).

| Score | n | Expectancy R | PF |
|---:|---:|---:|---:|
| 8–9 | 0 | — | — |
| 10 | 79 | +0.045R | 1.10 |
| 11 | 38 | −0.192R | 0.60 |
| 12 | 18 | +0.102R | 1.31 |
| 13 | 2 | +0.530R | 2.87 |
| 14 | 1 | −1.023R | 0.00 |
| 15 | 0 | — | — |

Grouped expectancy (n-weighted; PF not pooled):

| Bucket | n | Expectancy R |
|---|---:|---:|
| 10–11 | 117 | −0.032R |
| 12–13 | 20 | +0.145R |
| 14 | 1 | −1.023R |
| 15 | 0 | — |

No evidence to move the A+ line. n at 13+ is too small.

---

## Testnet certification ≠ strategy certification

Demo closes −0.42 / −0.18 / −0.09 are **TEST_ORDER** infrastructure round-trips. They are not expectancy.

TP1/TP2/TP3 on Demo BTC min qty is **PARTIAL**. Must close before LIVE with a size that allows 30/30/40.

---

## Soak / AUTO stages

| Gate | Status |
|---|---|
| 24h+ soak | **FAIL** — production-readiness uptime **0.80h** |
| Paper AUTO 20–30 closes | **not started** (blocked until edge gate) |
| TESTNET AUTO | **not started** |
| LIVE | **NO** |

---

## What was not changed

Risk Engine, Kill Switch, recovery, Binance execution, Telegram, DB, encryption, duplicate/stale/no-lookahead protections, **confluence weights**.
