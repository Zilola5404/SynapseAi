# SYNAPSEAI BACKTEST RESULTS

**Run:** 2026-09-02T20:10:26.186Z
**Universe:** BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, XRPUSDT, ADAUSDT
**Timeframes:** 1D, 4H, 1H, 15m, 5m (walk on 5m, step=6)
**Split:** 50/25/25 by 5m time — parameters frozen, no retune after OOS
**Lookahead:** candlesAtOrBefore(t) only
**Costs:** taker fee + slippage in fill sim
**Funding:** not simulated in backtest (applied on live Testnet closes)

## Per symbol trade counts

- BTCUSDT: 9
- ETHUSDT: 15
- SOLUSDT: 6
- BNBUSDT: 6
- XRPUSDT: 3
- ADAUSDT: 0

### Train (50%)

Trades: **33** (SL 2 / TP 0 / time 31)

| Grade | Trades | Win rate | PF | Expectancy | Avg R | Max DD | Net |
|---|---:|---:|---:|---:|---:|---:|---:|
| A+ | 1 | 100.0% | n/a | 34.02 | 0.73 | 0.00 | 34.02 |
| A | 32 | 59.4% | 2.07 | 5.62 | 0.15 | -128.85 | 179.77 |
| B | 0 | 0.0% | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |

### Validation (25%)

Trades: **6** (SL 1 / TP 2 / time 3)

| Grade | Trades | Win rate | PF | Expectancy | Avg R | Max DD | Net |
|---|---:|---:|---:|---:|---:|---:|---:|
| A+ | 0 | 0.0% | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| A | 6 | 50.0% | 2.11 | 15.73 | 0.45 | -85.27 | 94.36 |
| B | 0 | 0.0% | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |

### Out-of-sample (25%)

Trades: **0** (SL 0 / TP 0 / time 0)

| Grade | Trades | Win rate | PF | Expectancy | Avg R | Max DD | Net |
|---|---:|---:|---:|---:|---:|---:|---:|
| A+ | 0 | 0.0% | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| A | 0 | 0.0% | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| B | 0 | 0.0% | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |

### All windows

Trades: **39** (SL 3 / TP 2 / time 34)

| Grade | Trades | Win rate | PF | Expectancy | Avg R | Max DD | Net |
|---|---:|---:|---:|---:|---:|---:|---:|
| A+ | 1 | 100.0% | n/a | 34.02 | 0.73 | 0.00 | 34.02 |
| A | 38 | 57.9% | 2.08 | 7.21 | 0.20 | -138.48 | 274.13 |
| B | 0 | 0.0% | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |

## A+ vs A (all windows)

**A+ is not automatically better than A.** This sample does not support that claim (need ≥30 closed A+ and ≥30 A, plus better expectancy/PF).

A+ trades: 1. A trades: 38. B executed: 0 (B is NO TRADE in live engine).

## Confluence calibration (train vs OOS)

Weights were **not** changed. Table is diagnostic only.

| Factor | Train n ON/OFF | Train exp ON vs OFF | Improves on train? | OOS exp ON vs OFF |
|---|---:|---:|---|---:|
| btc | 33/0 | 6.48 vs 0.00 | no | 0.00 vs 0.00 |
| h4 | 33/0 | 6.48 vs 0.00 | no | 0.00 vs 0.00 |
| structure | 27/6 | 7.28 vs 2.87 | yes | 0.00 vs 0.00 |
| level | 33/0 | 6.48 vs 0.00 | no | 0.00 vs 0.00 |
| liquidity | 0/33 | 0.00 vs 6.48 | no | 0.00 vs 0.00 |
| bos | 10/23 | 4.54 vs 7.32 | no | 0.00 vs 0.00 |
| volume | 9/24 | 10.85 vs 4.84 | yes | 0.00 vs 0.00 |
| rr | 33/0 | 6.48 vs 0.00 | no | 0.00 vs 0.00 |

## Flags

- OOS expectancy > 0: **NO**
- Sample A+/A ≥30 each: **NO**
- A+ statistically preferred on this run: **NO**

This is research, not a profit guarantee. LIVE stays off.
