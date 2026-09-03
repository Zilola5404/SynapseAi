# STRATEGY DECISION

**Run:** 2026-09-03T10:25:30.780Z
**Canonical exit:** NO_TIME_EXIT (variant B)
**Canonical validation:** `reports/strategy-validation.md`

## OPTION B — EDGE IS REGIME DEPENDENT

Not a universal bot. TRENDING n=87 exp **+0.068R** vs HIGH_VOLATILITY n=51 exp **−0.151R**. Median TRENDING is still negative.

This is **not** OPTION A: overall 24h expectancy −0.013R, A+ n=3, train −0.097R / val −0.264R, Window 3 OOS −0.442R PF 0.18.

**Not applied in Intelligence this pass:** expanding `noNewTrades` to HIGH_VOLATILITY would change the live strategy. `reports/regime-gate-validation.md`: RANGING-blocked shadows printed **better** expectancy than allowed trades (**REGIME FILTER = BAD** on that sample). Do not blindly add more vetoes. Do not lower A+.

Canonical exit **NO_TIME_EXIT** is applied: backtest `simulateFill` defaults to `EXIT_POLICY.maxHoldBars`. PAPER/TESTNET/LIVE: `EXIT_POLICY.maxHoldMs = 0`.

Paper AUTO 20–30 and TESTNET AUTO are **not** opened from this verdict. Soak 24h is not passed (uptime 0.80h).

**ALLOW_LIVE:** false
