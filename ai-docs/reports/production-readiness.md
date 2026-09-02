# SYNAPSEAI PRODUCTION READINESS

**Дата:** 2026-09-02
**ALLOW_LIVE:** false

## TECHNICAL EXECUTION

**PASS**

Demo FILLED / SL-TP / recovery / kill switch already certified. Not re-run in this research pass.

## STRATEGY BACKTEST

**FAIL** — INSUFFICIENT_SAMPLE

History 549.6d. Trades 141. A+ 3, A 138. Expectancy -0.022R.
See `reports/backtest-results.md`, `reports/walk-forward-results.md`.

## OUT OF SAMPLE

**PASS** (pipeline: 63 closed OOS trades, not a zero-window bug)

Expectancy **+0.122R**, median **~0R**, PF 1.35. This is not a strategy pass: A+ sample is 3.

## PAPER TRADING

**FAIL** (AUTO PAPER 10–20 closes still not collected in this pass)

## TESTNET AUTO

**FAIL** (AUTO A+ soak still not collected)

## STABILITY

**FAIL** — uptime 0.80h

## LIVE READINESS

**NO**

Intelligence not rewritten. Weights not fitted to this history.
