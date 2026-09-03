# EXIT SENSITIVITY

**Run:** 2026-09-03T10:25:30.780Z
**Entry policy frozen.** Same signal indices for every hold. Intelligence not changed.

Adopt a finite cap only if it beats NO_TIME_EXIT on expectancy R by >0.05 AND on max DD R (less severe). Then take the shortest such cap. Otherwise keep live parity: no time exit.

| Hold | Trades | Expectancy R | PF | Max DD R | Avg hold | Avg MFE | Avg MAE | Win rate |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| NO_TIME_EXIT | 138 | -0.023R | 0.96 | -18.650R | 65.25h | +1.175R | -0.909R | 35.5% |
| 12h | 138 | -0.050R | 0.87 | -12.549R | 9.11h | +0.803R | -0.674R | 43.5% |
| 24h | 138 | -0.013R | 0.97 | -11.906R | 14.89h | +0.966R | -0.743R | 42.8% |
| 48h | 138 | -0.037R | 0.93 | -15.864R | 23.32h | +1.043R | -0.827R | 37.0% |
| 72h | 138 | -0.058R | 0.89 | -17.942R | 29.34h | +1.074R | -0.858R | 38.4% |

**Canonical policy:** **NO_TIME_EXIT** (variant B)

Adopt a finite cap only if it beats NO_TIME_EXIT on expectancy R by >0.05 AND on max DD R (less severe). Then take the shortest such cap. Otherwise keep live parity: no time exit.

Backtest will use no time cap (EOD at end of series only). PAPER/TESTNET/LIVE already have no TIME_EXIT (`EXIT_POLICY.maxHoldMs = 0`).

LIVE remains disabled as a trading mode. This only aligns the exit rule if a cap is adopted.
