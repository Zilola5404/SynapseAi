# SYNAPSEAI STRATEGY VALIDATION (LEGACY — 15-day snapshot)

**Archived:** 2026-09-03  
**Do not use as current truth.** Canonical file: `reports/strategy-validation.md`

**Period:** historical walk 2026-09-02 (public USD-M klines, ~15 days of 5m) + Testnet Demo fills  
**Вердикт at the time:** **A+ не доказан лучше A.** OOS пустой. LIVE не готов.

Источник: `scripts/run-backtest.ts` → then-current `reports/backtest-results.md` (superseded by the 18-month walk).

## Historical walk (fees + slippage, no lookahead, 50/25/25)

| Grade | Trades | Win Rate | Profit Factor | Expectancy | Average R | Max DD (USDT path) | Net |
|---|---:|---:|---:|---:|---:|---:|---:|
| A+ | 1 | 100% | n/a | +34.02 | 0.73 | 0 | +34.02 |
| A | 38 | 57.9% | 2.08 | +7.21 | 0.20 | -138.48 | +274.13 |
| B | 0 | — | — | — | — | — | — |

B в live engine = NO TRADE, поэтому 0 исполнений ожидаемо.

Train 33 / Validation 6 / **OOS 0**.

## Acceptance P2

- ≥30 A+ closed: **NO** (1)  
- ≥30 A closed: **YES** (38) on backtest fills, not live  
- A+ better expectancy and PF with adequate sample: **NO**

## Confluence (train only, weights not changed)

Improves expectancy on train when ON vs OFF (n ON and OFF ≥5): **structure**, **volume**.  
**liquidity** was ON in 0 train trades — нельзя калибровать.  
OOS: нет сделок, калибровка не подтверждена.

Не меняли веса под одну историю.

## Testnet live (not strategy)

Ручные TEST ORDER / TP ladder — инфраструктура, не A+ edge.

## Paper / Testnet AUTO soak

Не набраны (P7/P8). См. `reports/production-readiness.md`.
