# SYNAPSEAI BACKTEST RESULTS

**Run:** 2026-09-02T20:34:01.820Z  
**Hold in this file:** **24h TIME cap** (then-current harness). Canonical policy after 2026-09-03 exit-sensitivity is **NO_TIME_EXIT** — see `reports/exit-sensitivity.md` and `reports/strategy-validation.md`. Do not treat these TIME counts as live behavior.

**Universe:** BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, XRPUSDT, ADAUSDT
**Timeframes:** 1D, 4H, 1H, 15m, 5m (walk on 5m, step=6)
**History:** ~549.6 days (18 months requested)
**Split:** rolling walk-forward train 182d / val 61d / oos 61d shift 61d
**Lookahead:** closedWindow(t) only, live lookback 500 candles
**Entry:** NEXT_BAR_OPEN_PLUS_SLIPPAGE
**Same-bar SL+TP:** WORST_CASE_SL
**Costs:** taker fee + slippage. **Primary metric: R**, USDT is secondary.
**Funding:** simulated from Binance fundingRate history
**Intelligence:** not rewritten. Confluence weights not changed.

## Sample gates

| Check | Value |
|---|---|
| Label | **INSUFFICIENT_SAMPLE** |
| STRATEGY PASS | **NO** |
| Issues | A+_INSUFFICIENT_SAMPLE |
| A+ / A / OOS n | 3 / 138 / 63 |

A single +USDT trade cannot pass the strategy. R metrics below.

## Loaded candles

- BTCUSDT: 158287 × 5m from 2025-03-02T05:55:00.000Z to 2026-09-02T20:29:59.999Z, funding points 1647
- ETHUSDT: 158287 × 5m from 2025-03-02T05:55:00.000Z to 2026-09-02T20:29:59.999Z, funding points 1647
- SOLUSDT: 158287 × 5m from 2025-03-02T05:55:00.000Z to 2026-09-02T20:29:59.999Z, funding points 1647
- BNBUSDT: 158287 × 5m from 2025-03-02T05:55:00.000Z to 2026-09-02T20:29:59.999Z, funding points 1647
- XRPUSDT: 158287 × 5m from 2025-03-02T05:55:00.000Z to 2026-09-02T20:29:59.999Z, funding points 1647
- ADAUSDT: 158287 × 5m from 2025-03-02T05:55:00.000Z to 2026-09-02T20:29:59.999Z, funding points 1647

### Train

Trades: **59** (SL 28 / TP 12 / TIME 19)

| Metric | Value |
|---|---:|
| Total R | -5.738R |
| Average / Expectancy R | -0.097R |
| Median R | -0.477R |
| Win rate | 35.6% |
| Profit factor (R) | 0.82 |
| Max drawdown R | -8.420R |
| Max consecutive losses | 5 |
| Average win R | +1.220R |
| Average loss R | -0.825R |
| Net USDT (secondary) | -286.88 |

### Validation

Trades: **19** (SL 9 / TP 2 / TIME 8)

| Metric | Value |
|---|---:|
| Total R | -5.018R |
| Average / Expectancy R | -0.264R |
| Median R | -0.431R |
| Win rate | 42.1% |
| Profit factor (R) | 0.50 |
| Max drawdown R | -5.018R |
| Max consecutive losses | 5 |
| Average win R | +0.639R |
| Average loss R | -0.921R |
| Net USDT (secondary) | -250.89 |

### Out-of-sample

Trades: **63** (SL 19 / TP 13 / TIME 31)

| Metric | Value |
|---|---:|
| Total R | +7.670R |
| Average / Expectancy R | +0.122R |
| Median R | -0.005R |
| Win rate | 49.2% |
| Profit factor (R) | 1.35 |
| Max drawdown R | -5.432R |
| Max consecutive losses | 5 |
| Average win R | +0.958R |
| Average loss R | -0.688R |
| Net USDT (secondary) | 383.49 |

### All windows

Trades: **141** (SL 56 / TP 27 / TIME 58)

| Metric | Value |
|---|---:|
| Total R | -3.085R |
| Average / Expectancy R | -0.022R |
| Median R | -0.335R |
| Win rate | 42.6% |
| Profit factor (R) | 0.95 |
| Max drawdown R | -11.934R |
| Max consecutive losses | 7 |
| Average win R | +1.007R |
| Average loss R | -0.784R |
| Net USDT (secondary) | -154.27 |


## OOS proof

OOS contains **63** closed trades. Pipeline produced fills, not an empty window.

## A+ vs A

**INSUFFICIENT SAMPLE** to claim A+ > A (need ≥30 each). A+=3, A=138.

## Confluence factors (diagnostic only — weights frozen)

| Factor | Train n ON/OFF | Train exp ON vs OFF | Improves on train? | OOS exp ON vs OFF |
|---|---:|---:|---|---:|
| btc | 46/13 | -1.87 vs -15.44 | yes | 16.53 vs -1.25 |
| h4 | 59/0 | -4.86 vs 0.00 | no | 6.09 vs 0.00 |
| structure | 44/15 | -7.07 vs 1.63 | no | 7.19 vs 0.27 |
| level | 59/0 | -4.86 vs 0.00 | no | 6.09 vs 0.00 |
| liquidity | 3/56 | -37.29 vs -3.13 | no | 26.94 vs 5.04 |
| bos | 29/30 | -5.70 vs -4.05 | no | -0.24 vs 17.09 |
| volume | 13/46 | -4.02 vs -5.10 | yes | 12.07 vs 4.38 |
| rr | 59/0 | -4.86 vs 0.00 | no | 6.09 vs 0.00 |

## Execution model audit

- Entry fill: next 5m open ± slippage.
- SL / TP: stop checked before TP on each bar.
- Same-bar SL and TP: **SL** (0 trades marked ambiguous).
- Partial TP: 30/30/40 of remaining, matching live scale-out config (not retuned).
- Time exit: 288 × 5m = 24h cap. Live engine has no TIME kill-switch.
- Fees: taker in and out.
- Funding cash: -15.2384 USDT across trades.

Funding simulation included (signed, same sign as live Net = Gross − Fees + Funding).

LIVE stays off.
