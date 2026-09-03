# TELEGRAM TRADES AUDIT

**Source:** PostgreSQL `order_history` + `active_positions` + `exchange_orders` (script `scripts/dump-trade-audit.ts`).  
**Binance:** live REST was used only where `isPaperTrade=false` (TESTNET Demo order IDs below). PAPER rows have no Binance Futures order.  
**Generated:** 2026-09-03. No guesses — numbers are from DB.

Fee model in code: net = gross − entryFee − exitFee + funding (`computeTradePnl`).

---

## Highlighted losses

### 1) −$89.06 — PAPER BTCUSDT LONG

| Field | Value |
|---|---|
| Trade ID (`order_history.id`) | `cmtk05lnb000lglgsutuln49g` |
| Position ID | `cmthqdrdx007egllwjpip376f` |
| Exchange Order ID | `SENTmthqdr78r6w64k` (PAPER client id, not Binance) |
| Binance | **N/A — PAPER.** No Demo/Live fill. |
| Symbol | BTCUSDT |
| Direction | LONG |
| Quantity | 0.03801205688561479 |
| Leverage | 3 |
| Notional | $2998.34 (`entry × qty`) |
| Entry Price | 78878.592564 |
| Exit Price | 76566.41022 |
| SL (position row) | 78720.71 |
| TP (position row) | 79147.04 |
| Initial Risk $ | **$6.00** = qty × \|entry − SL\| = 0.03801205688561479 × 157.882564 |
| Gross PnL | −$87.8908 (matches qty × (exit − entry) = 0.03801205688561479 × −2312.182344) |
| Entry Fee | **$0.00 in history.** Entry `exchange_orders` fee = **$1.1993** (not copied into history). |
| Exit Fee | $1.1642 |
| Funding | $0.00 |
| Net PnL (history) | **−$89.06** = −87.8908 − 1.1642 |
| Exit Reason | `STOP_LOSS` |
| Open Time | 2026-08-31T21:08:54.885Z |
| Close Time | 2026-09-02T11:18:02.709Z |
| Holding Time | **38h 9m 8s** |
| Rationale | `Trend+Momentum LONG: EMA20>EMA50... RR 2 \| AI filter skipped (нет GEMINI_API_KEY)` |

If the stored SL had been the fill: qty × (78878.592564 − 78720.71) ≈ **−$6.00** plus round-trip fees (~$2.4). Actual adverse move was **2.93%**, not the 0.20% SL distance.

**ROOT CAUSE: RISK MANAGEMENT FAILURE**

Facts that support this and rule out the other listed labels:

- **Not POSITION SIZE BUG.** Notional $2998.34 is the PAPER `maxNotional` cap (~$3000), leverage 3. Planned dollar risk at the stored SL is **$6.00**, not $89.
- **Not DATABASE / PNL ACCOUNTING ERROR of this magnitude.** Gross = qty × price move to the cent. The only accounting defect is **missing entry fee** on the history row (~$1.20). That does not create an $89 loss.
- **Not NORMAL STRATEGY LOSS at the planned SL.** The close is labelled `STOP_LOSS` but the fill **76566.41 is $2154 below the stored SL 78720.71**. A strategy SL hit at 78720 would be ~$6 + fees.
- Process window: opened 2026-08-31 21:08Z, closed 2026-09-02 11:18Z. PAPER SL is enforced only while the local monitor loop is running. The fill used a later mark, not the SL price.

---

### 2) −$7.54 — PAPER BTCUSDT LONG

| Field | Value |
|---|---|
| Trade ID | `cmthq9mdk004jgllwj4mnuems` |
| Exchange Order ID | `SENTmthptj27wt52zz` (PAPER) |
| Binance | N/A — PAPER |
| Symbol / Direction | BTCUSDT LONG |
| Quantity | 0.03802325705191999 |
| Leverage | 3 |
| Notional | $3000.60 |
| Entry / Exit | 78914.859816 → 78747.976446 |
| SL / TP | Position row not retained (`positionId` null). Price move $166.88 × qty ≈ **$6.35** |
| Gross (recomputed) | −$6.35. History `grossPnl` stored as 0 (old row). |
| Fees in history | $1.1977 (exit `exchange_orders` fee). Entry order fee $1.2002 not in history. |
| Net PnL (history) | **−$7.54** ≈ −6.35 − 1.20 |
| Exit Reason | `STOP_LOSS` |
| Open / Close | 2026-08-31T20:53:11.196Z → 2026-08-31T21:05:41.767Z |
| Holding Time | **12m 30s** |

**Classification:** NORMAL STRATEGY LOSS (stop reached within minutes). Size same ~$3000 PAPER cap. Residual: one-sided fee on the history row.

---

### 3) −$0.62 — TESTNET TEST_ORDER

| Field | Value |
|---|---|
| Trade ID | `cmtkj6m5d00b1glskpox0lkk8` |
| Position ID | `cmtkj6ee3000pgl7oyqsjo1ai` |
| Exchange Order ID | **28567666570** (Binance Demo) |
| Symbol / Direction | BTCUSDT LONG |
| Quantity | 0.01 |
| Leverage | 3 |
| Notional | $773.52 |
| Entry / Exit | 77351.5 → 77351.4 |
| SL / TP | 76191.23 / 77970.31 (TEST_ORDER 1.5% / ladder) |
| Gross | $0.00 (flat 0.1 tick) |
| Entry Fee / Exit Fee | $0.3094 / $0.3094 |
| Funding | $0.00 |
| Net PnL | **−$0.62** (round-trip taker on certification close) |
| Exit Reason | `EXCHANGE` |
| Open / Close | 2026-09-02T20:10:32.668Z → 2026-09-02T20:10:42.720Z (~10s) |
| Rationale | `A+ TEST_ORDER` |

**Classification:** certification round-trip. Not a strategy loss.

---

### 4) −$0.47 — TESTNET leftover after TP ladder

| Field | Value |
|---|---|
| Trade ID | `cmtkj8ifk00cnglskbubrj397` |
| Position ID | `cmtkj7zq0000pgl00hs94qvx2` |
| Exchange Order ID | **28567667296** (entry). Close order 28567667552 qty 0.004 |
| Symbol / Direction | BTCUSDT LONG |
| Quantity (closed remainder) | 0.004 of original 0.01 TEST_ORDER |
| Leverage | 3 |
| Notional (remainder) | $309.41 |
| Entry / Exit | 77351.5 → 77341.3 |
| SL / TP | 76173.89 / 77952.57 |
| Gross | −$0.0408 |
| Entry Fee / Exit Fee | $0.3094 / $0.1237 |
| Net PnL | **−$0.47** |
| Exit Reason | `EXCHANGE` |
| Open / Close | 2026-09-02T20:11:46.969Z → 2026-09-02T20:12:11.215Z (~24s) |
| Rationale | `A+ TEST_ORDER`, plan `hits: 2` |

**Classification:** TEST_ORDER leftover flatten. Loss is fees on remainder, not a discretionary setup.

---

## Other history rows

| Trade ID | Mode | Net | Reason | Notes |
|---|---|---:|---|---|
| `cmth414xg000vgliouk464k1m` | PAPER | −$0.01 | KILL_SWITCH | BTC 0.0064, ~21s, fees 0 in row |
| `cmth414yl000zglioff8q3f87` | PAPER | $0.00 | KILL_SWITCH | ETH, immediate flatten |
| `cmth414zg0013glionefg91hw` | PAPER | $0.00 | KILL_SWITCH | SOL, immediate flatten |
| `cmtkgamoe001yglaon91xokcc` | TESTNET | −$0.09 | EXCHANGE | TEST_ORDER 0.002 BTC, ~8s, order **28567613072**, fees $0.0867 |
| `cmtkhpxtk00a5glswjn1dfm4l` | TESTNET | −$0.42 | EXCHANGE | TEST_ORDER 0.002, order **28567615142**, ~37m, fees $0.1236 |
| `cmtkhwfkr00e6glswo7xe2f71` | TESTNET | −$0.18 | EXCHANGE | TEST_ORDER 0.002, order **28567641532**, ~3m, fees $0.1234 |

TESTNET min-qty rows are certification closes (0.002 BTC). Net ≈ round-trip taker ± a few ticks.

---

## Position-size check (all closed BTC rows)

| Row | Qty | Notional | Planned SL risk (if SL stored) |
|---|---:|---:|---|
| −$89.06 PAPER | 0.038012 | $2998 | $6.00 at SL 78720.71 |
| −$7.54 PAPER | 0.038023 | $3001 | ~$6.35 from actual SL-distance fill |
| TESTNET 0.002 | 0.002 | ~$155 | TEST_ORDER min qty |
| TESTNET 0.01 | 0.01 | ~$774 | TEST_ORDER certified size |

PAPER sizes match a ~$3000 notional cap, not a “$3000 risk” bug. The $89 event is an **unattended paper stop**, not a sizer explosion.

---

## Accounting notes (do not explain −$89)

1. PAPER −$89.06 history **omits entry fee** $1.1993 recorded on `exchange_orders`.
2. PAPER −$7.54 stores `grossPnl=0` though qty × move is −$6.35.
3. These are bookkeeping defects of **~$1**, not tens of dollars.
