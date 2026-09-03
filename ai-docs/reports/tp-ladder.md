# TP LADDER

**Date:** 2026-09-04  
**Live TESTNET order was not placed in this pass** (certification walk-forward takes priority; AUTO is off).

## Policy (unchanged)

`INTEL.scaleOut` / `TP_SCALE_OUT` = **30% / 30% / 40%**.

Code:

- `server/trading/tpPolicy.ts`
- `splitScaleOutQty` in `server/exchanges/binance/precision.ts`
- TESTNET/LIVE scale-out: `TradingOrchestrator.scaleOutQty` → `closeMarket({ reduceOnly: true })`
- Full close: `closeMarket({ reduceOnly: true })`

## Unit check (this pass)

`server/trading/tpPolicy.test.ts`:

- Fractions sum to 1
- BTCUSDT qty **0.01** (minQty 0.001) splits into 3 legs
- Sum of legs = original quantity
- Qty 0.001 BTC cannot split (LOT_SIZE) → `null` fallback

PASS on unit tests. Exchange round-trip (`scripts/place-tp-ladder.ts`) is **not** claimed here.

## reduceOnly

Scale-out and flatten on the exchange path set `reduceOnly: true`. That flag is required so a close cannot flip into a new position.
