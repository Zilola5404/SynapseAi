# CANONICAL WALK-FORWARD

**Run:** 2026-09-03T22:28:32.298Z
**Universe:** BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, XRPUSDT, ADAUSDT
**History:** ~549.6 days (18 months requested)
**Entry / weights / risk / costs:** unchanged (frozen Intelligence)
**Lookahead:** forbidden — closedWindow(t) only
**Exit:** NO_TIME_EXIT (maxHoldBars=1000000, maxHoldMs=0)
**Split:** rolling walk-forward train 182d / val 61d / oos 61d shift 61d

This file is the certification walk. Weights were not fit on this run.

## Per-window TRAIN / VALIDATION / OOS

| Window | Bucket | Trades | Expectancy | Median | PF | Win Rate | Max DD | Max consec. losses | Avg hold |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | TRAIN | 44 | +0.004R | -1.015R | 1.01 | 38.6% | -7.404R | 6 | 98.01 h |
| 1 | VALIDATION | 13 | -0.598R | -1.022R | 0.30 | 15.4% | -8.931R | 9 | 28.05 h |
| 1 | OOS | 6 | +0.526R | +0.601R | 2.74 | 50.0% | -1.424R | 2 | 157.29 h |
| 2 | TRAIN | 51 | -0.131R | -1.018R | 0.80 | 33.3% | -11.780R | 9 | 76.04 h |
| 2 | VALIDATION | 6 | +0.526R | +0.601R | 2.74 | 50.0% | -1.424R | 2 | 157.29 h |
| 2 | OOS | 11 | +0.200R | -0.521R | 1.38 | 45.5% | -2.107R | 2 | 24.10 h |
| 3 | TRAIN | 50 | -0.145R | -1.018R | 0.78 | 32.0% | -9.558R | 7 | 51.34 h |
| 3 | VALIDATION | 11 | +0.200R | -0.521R | 1.38 | 45.5% | -2.107R | 2 | 24.10 h |
| 3 | OOS | 10 | -0.440R | -1.016R | 0.43 | 20.0% | -5.574R | 4 | 55.97 h |
| 4 | TRAIN | 30 | -0.081R | -1.013R | 0.87 | 33.3% | -6.638R | 5 | 52.45 h |
| 4 | VALIDATION | 10 | -0.440R | -1.016R | 0.43 | 20.0% | -5.574R | 4 | 55.97 h |
| 4 | OOS | 10 | +0.218R | -0.425R | 1.49 | 40.0% | -2.460R | 3 | 59.92 h |
| 5 | TRAIN | 26 | -0.028R | -0.763R | 0.95 | 34.6% | -4.905R | 4 | 52.13 h |
| 5 | VALIDATION | 10 | +0.218R | -0.425R | 1.49 | 40.0% | -2.460R | 3 | 59.92 h |
| 5 | OOS | 14 | +0.245R | +0.061R | 1.54 | 50.0% | -3.678R | 4 | 120.60 h |


## WINDOW 1

TRAIN 2025-03-05T01:30:00.000Z → 2025-09-03T01:30:00.000Z
VAL 2025-09-03T01:30:00.000Z → 2025-11-03T01:30:00.000Z
OOS 2025-11-03T01:30:00.000Z → 2026-01-03T01:30:00.000Z

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

### OOS

Trades: **6** (SL 3 / TP 3 / TIME 0)

| Metric | Value |
|---|---:|
| Total R | +3.155R |
| Average / Expectancy R | +0.526R |
| Median R | +0.601R |
| Win rate | 50.0% |
| Profit factor (R) | 2.74 |
| Max drawdown R | -1.424R |
| Max consecutive losses | 2 |
| Average hold | 157.29 h |
| Average win R | +1.657R |
| Average loss R | -0.606R |
| Net USDT (secondary) | 157.73 |

## WINDOW 2

TRAIN 2025-05-05T01:30:00.000Z → 2025-11-03T01:30:00.000Z
VAL 2025-11-03T01:30:00.000Z → 2026-01-03T01:30:00.000Z
OOS 2026-01-03T01:30:00.000Z → 2026-03-05T01:30:00.000Z

### Train

Trades: **51** (SL 34 / TP 17 / TIME 0)

| Metric | Value |
|---|---:|
| Total R | -6.656R |
| Average / Expectancy R | -0.131R |
| Median R | -1.018R |
| Win rate | 33.3% |
| Profit factor (R) | 0.80 |
| Max drawdown R | -11.780R |
| Max consecutive losses | 9 |
| Average hold | 76.04 h |
| Average win R | +1.589R |
| Average loss R | -0.990R |
| Net USDT (secondary) | -332.81 |

### Validation

Trades: **6** (SL 3 / TP 3 / TIME 0)

| Metric | Value |
|---|---:|
| Total R | +3.155R |
| Average / Expectancy R | +0.526R |
| Median R | +0.601R |
| Win rate | 50.0% |
| Profit factor (R) | 2.74 |
| Max drawdown R | -1.424R |
| Max consecutive losses | 2 |
| Average hold | 157.29 h |
| Average win R | +1.657R |
| Average loss R | -0.606R |
| Net USDT (secondary) | 157.73 |

### OOS

Trades: **11** (SL 6 / TP 5 / TIME 0)

| Metric | Value |
|---|---:|
| Total R | +2.197R |
| Average / Expectancy R | +0.200R |
| Median R | -0.521R |
| Win rate | 45.5% |
| Profit factor (R) | 1.38 |
| Max drawdown R | -2.107R |
| Max consecutive losses | 2 |
| Average hold | 24.10 h |
| Average win R | +1.582R |
| Average loss R | -0.952R |
| Net USDT (secondary) | 109.85 |

## WINDOW 3

TRAIN 2025-07-05T01:30:00.000Z → 2026-01-03T01:30:00.000Z
VAL 2026-01-03T01:30:00.000Z → 2026-03-05T01:30:00.000Z
OOS 2026-03-05T01:30:00.000Z → 2026-05-05T01:30:00.000Z

### Train

Trades: **50** (SL 34 / TP 16 / TIME 0)

| Metric | Value |
|---|---:|
| Total R | -7.231R |
| Average / Expectancy R | -0.145R |
| Median R | -1.018R |
| Win rate | 32.0% |
| Profit factor (R) | 0.78 |
| Max drawdown R | -9.558R |
| Max consecutive losses | 7 |
| Average hold | 51.34 h |
| Average win R | +1.609R |
| Average loss R | -0.970R |
| Net USDT (secondary) | -361.54 |

### Validation

Trades: **11** (SL 6 / TP 5 / TIME 0)

| Metric | Value |
|---|---:|
| Total R | +2.197R |
| Average / Expectancy R | +0.200R |
| Median R | -0.521R |
| Win rate | 45.5% |
| Profit factor (R) | 1.38 |
| Max drawdown R | -2.107R |
| Max consecutive losses | 2 |
| Average hold | 24.10 h |
| Average win R | +1.582R |
| Average loss R | -0.952R |
| Net USDT (secondary) | 109.85 |

### OOS

Trades: **10** (SL 8 / TP 2 / TIME 0)

| Metric | Value |
|---|---:|
| Total R | -4.404R |
| Average / Expectancy R | -0.440R |
| Median R | -1.016R |
| Win rate | 20.0% |
| Profit factor (R) | 0.43 |
| Max drawdown R | -5.574R |
| Max consecutive losses | 4 |
| Average hold | 55.97 h |
| Average win R | +1.652R |
| Average loss R | -0.963R |
| Net USDT (secondary) | -220.22 |

## WINDOW 4

TRAIN 2025-09-04T01:30:00.000Z → 2026-03-05T01:30:00.000Z
VAL 2026-03-05T01:30:00.000Z → 2026-05-05T01:30:00.000Z
OOS 2026-05-05T01:30:00.000Z → 2026-07-05T01:30:00.000Z

### Train

Trades: **30** (SL 20 / TP 10 / TIME 0)

| Metric | Value |
|---|---:|
| Total R | -2.426R |
| Average / Expectancy R | -0.081R |
| Median R | -1.013R |
| Win rate | 33.3% |
| Profit factor (R) | 0.87 |
| Max drawdown R | -6.638R |
| Max consecutive losses | 5 |
| Average hold | 52.45 h |
| Average win R | +1.617R |
| Average loss R | -0.930R |
| Net USDT (secondary) | -121.29 |

### Validation

Trades: **10** (SL 8 / TP 2 / TIME 0)

| Metric | Value |
|---|---:|
| Total R | -4.404R |
| Average / Expectancy R | -0.440R |
| Median R | -1.016R |
| Win rate | 20.0% |
| Profit factor (R) | 0.43 |
| Max drawdown R | -5.574R |
| Max consecutive losses | 4 |
| Average hold | 55.97 h |
| Average win R | +1.652R |
| Average loss R | -0.963R |
| Net USDT (secondary) | -220.22 |

### OOS

Trades: **10** (SL 6 / TP 4 / TIME 0)

| Metric | Value |
|---|---:|
| Total R | +2.177R |
| Average / Expectancy R | +0.218R |
| Median R | -0.425R |
| Win rate | 40.0% |
| Profit factor (R) | 1.49 |
| Max drawdown R | -2.460R |
| Max consecutive losses | 3 |
| Average hold | 59.92 h |
| Average win R | +1.644R |
| Average loss R | -0.734R |
| Net USDT (secondary) | 108.83 |

## WINDOW 5

TRAIN 2025-11-04T01:30:00.000Z → 2026-05-05T01:30:00.000Z
VAL 2026-05-05T01:30:00.000Z → 2026-07-05T01:30:00.000Z
OOS 2026-07-05T01:30:00.000Z → 2026-09-04T01:30:00.000Z

### Train

Trades: **26** (SL 17 / TP 9 / TIME 0)

| Metric | Value |
|---|---:|
| Total R | -0.738R |
| Average / Expectancy R | -0.028R |
| Median R | -0.763R |
| Win rate | 34.6% |
| Profit factor (R) | 0.95 |
| Max drawdown R | -4.905R |
| Max consecutive losses | 4 |
| Average hold | 52.13 h |
| Average win R | +1.611R |
| Average loss R | -0.896R |
| Net USDT (secondary) | -36.88 |

### Validation

Trades: **10** (SL 6 / TP 4 / TIME 0)

| Metric | Value |
|---|---:|
| Total R | +2.177R |
| Average / Expectancy R | +0.218R |
| Median R | -0.425R |
| Win rate | 40.0% |
| Profit factor (R) | 1.49 |
| Max drawdown R | -2.460R |
| Max consecutive losses | 3 |
| Average hold | 59.92 h |
| Average win R | +1.644R |
| Average loss R | -0.734R |
| Net USDT (secondary) | 108.83 |

### OOS

Trades: **14** (SL 7 / TP 7 / TIME 0)

| Metric | Value |
|---|---:|
| Total R | +3.426R |
| Average / Expectancy R | +0.245R |
| Median R | +0.061R |
| Win rate | 50.0% |
| Profit factor (R) | 1.54 |
| Max drawdown R | -3.678R |
| Max consecutive losses | 4 |
| Average hold | 120.60 h |
| Average win R | +1.396R |
| Average loss R | -0.907R |
| Net USDT (secondary) | 171.30 |

Weights were not fit per window. This is frozen-parameter walk-forward.


## Sample gate (pre-declared, not fitted after the run)

| Check | Value |
|---|---|
| STRATEGY PASS | **NO** |
| Label | INSUFFICIENT_SAMPLE |
| Issues | A+_INSUFFICIENT_SAMPLE |
| OOS n / expectancy | 51 / +0.128R |
| Positive OOS windows | 4 / 5 |
