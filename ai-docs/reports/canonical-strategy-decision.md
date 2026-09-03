# CANONICAL STRATEGY DECISION

**Run:** 2026-09-03T22:28:32.298Z
**Source:** `ai-docs/reports/canonical-walk-forward.md`
**Exit:** NO_TIME_EXIT
**Gate:** `evaluateSampleGate` in `server/trading/backtest/rMetrics.ts` (declared before this run)

## VERDICT

# EDGE_NOT_CONFIRMED

The pre-declared gate did not pass. AUTO stays off. Weights / threshold / filters were **not** changed after this result.

## Why this label

- strategyPass = **false**
- issues: A+_INSUFFICIENT_SAMPLE
- OOS trades: 51 (need ≥ 30)
- OOS expectancy: +0.128R (need > 0 when OOS n is valid)
- Walk-forward windows: 5 (need ≥ 2)
- Positive OOS windows: 4
- A+ / A sample: 3 / 105 (need ≥ 30 each)

## Forbidden after this file

- Do not change confluence weights
- Do not change entry threshold
- Do not add filters to make this table look better

Next: investigate causes without curve-fitting. No PAPER AUTO.

LIVE remains disabled.
