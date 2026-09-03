# WALK-FORWARD CONSISTENCY

**Run:** 2026-09-03T10:25:30.780Z
Hold used for this table: **24h** (same as the published 18-month walk in `backtest-results.md`). Canonical live/backtest default is **NO_TIME_EXIT**.

| Window | Train R | Validation R | OOS R | OOS PF | OOS DD |
|---|---:|---:|---:|---:|---:|
| 1 | -0.080R (n=56) | -0.264R (n=19) | +0.092R (n=8) | 1.31 | -1.063R |
| 2 | -0.073R (n=67) | +0.092R (n=8) | +0.302R (n=12) | 1.75 | -2.107R |
| 3 | -0.131R (n=61) | +0.302R (n=12) | -0.442R (n=14) | 0.18 | -6.264R |
| 4 | -0.017R (n=39) | -0.442R (n=14) | +0.398R (n=10) | 4.25 | -1.017R |
| 5 | -0.081R (n=33) | +0.398R (n=10) | +0.290R (n=19) | 1.91 | -3.643R |

| Positive OOS windows | **4** |
| Negative OOS windows | **1** |
| % profitable OOS windows | **80.0%** |
| Median OOS expectancy | **+0.290R** |
| Worst OOS | **Window 3 −0.442R n=14 PF 0.18** (win rate 7.1%, 11 consecutive losses) |
| Best OOS | **Window 4 +0.398R n=10 PF 4.25** |

A single +R OOS total can hide a losing window. Percent of profitable OOS windows is the consistency check.
