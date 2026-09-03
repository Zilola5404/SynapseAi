# TRADE QUALITY GATES (documented, not curve-fit)

Values below are **policy floors**, not parameters searched on the −$89.06 row or on a backtest.

Source of AUTO regime restriction: `reports/regime-performance.md` (2026-09-03). TRENDING n=87 expectancy **+0.068R**; HIGH_VOLATILITY n=51 **−0.151R**. Intelligence `noNewTrades` for RANGING is **unchanged** (shadow sample on that gate was harmful).

## TRADE_COST_GATE

File: `server/trading/risk/tradeCostGate.ts`

| Constant | Value | Meaning |
|---|---|---|
| Fee | `TAKER_FEE` 0.0004 | Same as live/paper fill model |
| Slippage | `SLIPPAGE` 0.0002 each side | Round-trip = 2× |
| Funding at entry | 0 | Hold unknown; do not invent periods |
| `minNetRr` | **1.5** | Net reward / initial risk after costs |
| `minNetToCostRatio` | **2** | Expected net must be ≥ 2× total estimated costs |

```
Expected Gross Reward = qty × |TP − entry|
Estimated costs     = entryFee + exitFee + roundTripSlippage − fundingEstimate
Expected Net Reward = Expected Gross − estimated costs
Net RR              = Expected Net / initial risk
```

Reject reason:
- `TP_TOO_CLOSE_TO_COVER_COSTS` if expected gross ≤ total estimated costs
- `INSUFFICIENT_NET_EDGE` if net RR or net/cost floor fails
- `TRADING_COST_TOO_HIGH` kept as alias in logs

TEST_ORDER / certification path skips this gate (`skipCostGate`).

## AUTO quality class

File: `server/trading/decision/tradeQuality.ts`

AUTO TRADE only if **all** are true:

1. Market regime ∈ `INTEL.autoRegimes` = `["TRENDING"]`
2. HTF / structure / trigger already passed Intelligence (A+ signal exists)
3. Risk engine allowed
4. Cost + Net RR gate passed
5. Position size valid
6. No duplicate open position
7. No kill switch / account lock / circuit
8. Fresh market data
9. No setup-cluster pause
10. Consecutive-loss pause not active

Classes: `NO_TRADE` / `WATCH` / `SIGNAL` / `AUTO_TRADE`.

## Daily + streak guards (already in RiskEngine / User)

| Guard | Config | Behaviour |
|---|---|---|
| Daily loss | `RiskSettings.maxDailyLossPct` (user) | Rolling 24h realized PnL. On hit: auto off, `pauseUntil` = next UTC midnight. |
| Consecutive losses | `INTEL.consecutiveLossLimit` = 3 | Pause `INTEL.consecutiveLossPauseMs` = 1h |
| Loss cluster | `INTEL.lossClusterCount` = 3, `INTEL.lossClusterPauseMs` = 4h | Same symbol + side (+ same regime if known) → `SetupPause` |

The count **3** is the existing consecutive-loss policy, not a new backtest fit.

## Shadow signals

Rejected A/A+ (or reconstructed shadow plan) persisted as `signals.status = "SHADOW"` so Allowed vs Blocked can be compared later. Deduped per user/symbol/side for 5 minutes.
