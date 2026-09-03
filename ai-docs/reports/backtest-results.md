# SYNAPSEAI BACKTEST RESULTS

**Run:** 2026-09-03T22:28:32.298Z
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
| A+ / A / OOS n | 3 / 105 / 51 |

A single +USDT trade cannot pass the strategy. R metrics below.

## Loaded candles

- BTCUSDT: 158287 × 5m from 2025-03-03T07:50:00.000Z to 2026-09-03T22:24:59.999Z, funding points 1646
- ETHUSDT: 158287 × 5m from 2025-03-03T07:50:00.000Z to 2026-09-03T22:24:59.999Z, funding points 1646
- SOLUSDT: 158287 × 5m from 2025-03-03T07:50:00.000Z to 2026-09-03T22:24:59.999Z, funding points 1646
- BNBUSDT: 158287 × 5m from 2025-03-03T07:50:00.000Z to 2026-09-03T22:24:59.999Z, funding points 1646
- XRPUSDT: 158287 × 5m from 2025-03-03T07:50:00.000Z to 2026-09-03T22:24:59.999Z, funding points 1646
- ADAUSDT: 158287 × 5m from 2025-03-03T07:50:00.000Z to 2026-09-03T22:24:59.999Z, funding points 1646

### Train

Trades: **44** (SL 27 / TP 17 / TIME 0)

| Metric | Value |
|---|---:|
| Total R | +0.185R |
| Average / Expectancy R | +0.004R |
| Median R | -1.015R |
| Win rate | 38.6% |
| Profit factor (R) | 1.01 |
| Max drawdown R | -7.404R |
| Max consecutive losses | 6 |
| Average hold | 98.01 h |
| Average win R | +1.592R |
| Average loss R | -0.996R |
| Net USDT (secondary) | 9.24 |

### Validation

Trades: **13** (SL 11 / TP 2 / TIME 0)

| Metric | Value |
|---|---:|
| Total R | -7.777R |
| Average / Expectancy R | -0.598R |
| Median R | -1.022R |
| Win rate | 15.4% |
| Profit factor (R) | 0.30 |
| Max drawdown R | -8.931R |
| Max consecutive losses | 9 |
| Average hold | 28.05 h |
| Average win R | +1.643R |
| Average loss R | -1.006R |
| Net USDT (secondary) | -388.87 |

### Out-of-sample

Trades: **51** (SL 30 / TP 21 / TIME 0)

| Metric | Value |
|---|---:|
| Total R | +6.550R |
| Average / Expectancy R | +0.128R |
| Median R | -0.451R |
| Win rate | 41.2% |
| Profit factor (R) | 1.25 |
| Max drawdown R | -5.123R |
| Max consecutive losses | 4 |
| Average hold | 79.53 h |
| Average win R | +1.549R |
| Average loss R | -0.866R |
| Net USDT (secondary) | 327.48 |

### All windows

Trades: **108** (SL 68 / TP 40 / TIME 0)

| Metric | Value |
|---|---:|
| Total R | -1.043R |
| Average / Expectancy R | -0.010R |
| Median R | -1.008R |
| Win rate | 37.0% |
| Profit factor (R) | 0.98 |
| Max drawdown R | -14.301R |
| Max consecutive losses | 7 |
| Average hold | 80.86 h |
| Average win R | +1.572R |
| Average loss R | -0.940R |
| Net USDT (secondary) | -52.14 |


## OOS proof

OOS contains **51** closed trades. Pipeline produced fills, not an empty window.

## A+ vs A

**INSUFFICIENT SAMPLE** to claim A+ > A (need ≥30 each). A+=3, A=105.

## Confluence factors (diagnostic only — weights frozen)

| Factor | Train n ON/OFF | Train exp ON vs OFF | Improves on train? | OOS exp ON vs OFF |
|---|---:|---:|---|---:|
| btc | 30/14 | 5.88 vs -11.94 | yes | 16.80 vs 0.26 |
| h4 | 44/0 | 0.21 vs 0.00 | no | 6.42 vs 0.00 |
| structure | 33/11 | -15.68 vs 47.87 | no | 8.86 vs -6.66 |
| level | 44/0 | 0.21 vs 0.00 | no | 6.42 vs 0.00 |
| liquidity | 3/41 | -51.62 vs 4.00 | no | -4.76 vs 7.37 |
| bos | 21/23 | 13.27 vs -11.72 | yes | -3.80 vs 25.17 |
| volume | 12/32 | -5.65 vs 2.41 | no | 13.44 vs 4.02 |
| rr | 44/0 | 0.21 vs 0.00 | no | 6.42 vs 0.00 |

## Execution model audit

- Entry fill: next 5m open ± slippage.
- SL / TP: stop checked before TP on each bar.
- Same-bar SL and TP: **SL** (0 trades marked ambiguous).
- Partial TP: 30/30/40 of remaining, matching live scale-out config (not retuned).
- Time exit: canonical NO_TIME_EXIT (maxHoldBars=1000000, maxHoldMs=0). Same rule as PAPER / TESTNET / LIVE.
- Fees: taker in and out.
- Funding cash: -20.5763 USDT across trades.

Funding simulation included (signed, same sign as live Net = Gross − Fees + Funding).

LIVE stays off.
