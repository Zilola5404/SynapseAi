# STRATEGY DECISION

**Run:** 2026-09-03T10:25:30.780Z
**Canonical exit:** NO_TIME_EXIT (variant B)

## OPTION B — EDGE IS REGIME DEPENDENT

TRENDING n=87 exp +0.068R vs HIGH_VOLATILITY n=51 exp -0.151R. Not a universal bot. Do not retune weights here.

This is **not** a LIVE go. TRENDING expectancy is only +0.068R, median still negative, A+ n=3.

**Not applied in Intelligence this pass:** expanding `noNewTrades` to HIGH_VOLATILITY would change the live strategy. Confirm first — and note `reports/regime-gate-validation.md`: RANGING-blocked shadows printed **better** expectancy than allowed trades (**REGIME FILTER = BAD** on that sample). Do not blindly add more vetoes.

Canonical exit **NO_TIME_EXIT** is applied: backtest `maxHoldBars` matches live (no 24h TIME kill). `EXIT_POLICY.maxHoldMs = 0`.

**ALLOW_LIVE:** false
