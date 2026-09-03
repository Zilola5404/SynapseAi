# REGIME GATE VALIDATION

**Run:** 2026-09-03T10:25:30.780Z
Shadow = would have been A/A+ TRADE if `regime.noNewTrades` were ignored. **Not traded.** Same fill model (24h hold for this comparison).

| Group | Trades | Expectancy R | PF | Max DD R | Avg hold | Avg MFE | Avg MAE | Win rate |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Allowed (live TRADE) | 138 | -0.013R | 0.97 | -11.906R | 14.89h | +0.966R | -0.743R | 42.8% |
| Blocked by regime (shadow) | 135 | +0.276R | 2.15 | -6.314R | 17.33h | +1.260R | -0.665R | 54.1% |

Allowed n=138 exp -0.013R. Shadow n=135 exp +0.276R.

**REGIME FILTER = BAD** — blocked setups look better than allowed on this sample. Do not flip the gate from one run; this is diagnostic only.

Shadow A+ count: 6 (executed A+ remains 3).
