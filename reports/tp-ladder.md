# TP LADDER

**Date:** 2026-09-04  
**TESTNET round-trip:** PASS

## Policy (unchanged)

`INTEL.scaleOut` / `TP_SCALE_OUT` = **30% / 30% / 40%**.

Code:

- `server/trading/tpPolicy.ts`
- `splitScaleOutQty` in `server/exchanges/binance/precision.ts`
- TESTNET scale-out: `TradingOrchestrator.scaleOutQty` → `closeMarket({ reduceOnly: true })`
- Full close: cancel remaining orders, then `closeMarket({ reduceOnly: true })`

## Live TESTNET (BTCUSDT qty 0.01)

Script: `scripts/place-tp-ladder.ts`

| Step | Closed qty | Remaining |
| --- | --- | --- |
| Open | 0.010 | 100% |
| TP1 | 0.003 | 70% |
| TP2 | 0.003 | 40% |
| TP3 | 0.004 | 0% |

`sum(closed) = 0.003 + 0.003 + 0.004 = 0.010 = original quantity`

`reduceOnly=true` on each close.

## Unit check

`server/trading/tpPolicy.test.ts` — fractions sum to 1; minQty fallback.
