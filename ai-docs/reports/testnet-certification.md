# SYNAPSEAI TESTNET CERTIFICATION

**Дата:** 2026-09-02  
**Среда:** Binance USD-M Futures Demo (`demo-fapi.binance.com`)  
**LIVE:** `ALLOW_LIVE=false` (включён только explicit config)  
**Команды:** `npm test` PASS · `npm run lint` (`tsc --noEmit`) PASS

Цикл, который доказан на реальном Demo (не HTTP 200 «на глаз»):

Telegram → Market Data → Intelligence → Risk → min BTCUSDT MARKET → FILLED → Position → SL/TP algo → Monitoring → Close → PnL (gross − fees − funding=0) → PostgreSQL → Telegram.

## Чеклист

| Критерий | Статус | Доказательство |
|---|---|---|
| Binance API connection | **PASS** | `/api/health` `binanceRest=true` |
| Testnet environment | **PASS** | `BINANCE_USE_TESTNET=true`, Demo host, LIVE выключен |
| Account balance | **PASS** | Demo equity ≈ $5000 → после сделок ≈ $4999.27 |
| Symbol validation | **PASS** | BTCUSDT + precision gate |
| Precision validation | **PASS** | min qty 0.002 @ ~77k, MIN_NOTIONAL |
| Test order created | **PASS** | `/testorder` / `placeCertifiedTestOrder` |
| Order filled | **PASS** | orderId `28567615142`, `28567641532` status FILLED qty 0.002 |
| Position detected | **PASS** | `positionAmt=0.002` на Demo, затем flat |
| Database synchronized | **PASS** | `active_positions` OPEN→CLOSED, `order_history` |
| Stop Loss placed | **PASS** | algoId `1000000190213975`, `1000000190242089` |
| TP1 placed | **PARTIAL** | min BTC 0.002 нельзя нарезать 30/30/40 (лот 0.001). Ставится один TP algo. Unit 30/30/40 PASS |
| TP2 placed | **PARTIAL** | то же ограничение minQty |
| TP3 placed | **PARTIAL** | то же ограничение minQty |
| Partial close tested | **PARTIAL** | paper `scaleOut` + unit; live TP fill 30/70/40 **не** ловили по рынку |
| Manual close tested | **PASS** | `/testclose` → биржа amt=0, карточка закрытия, PnL в БД |
| PnL verified | **PASS** | Net = gross − entry fee − exit fee − funding(0). Пример: gross −0.30, fees 0.1236, net −0.42 |
| Restart recovery | **PASS** | `[RECOVERY]` при boot; recon DB↔exchange; после рестарта 2026-09-02 22:53 позиция не дублируется (exchange flat) |
| Duplicate protection | **PASS** | lock по символу + «already OPEN» + unit |
| Stale signal protection | **PASS** | `priceMovedTooFar` 0.8%, `SIGNAL_STALE`, Telegram «СИГНАЛ УСТАРЕЛ» |
| Market data stale protection | **PASS** | `DATA_FRESH / DATA_STALE / DATA_UNAVAILABLE`, `lastMarketUpdate` в `/api/health` |
| Kill switch | **PASS** | live `/panic`: cancel + flatten + lock; затем `/unlock` |
| Secrets not in browser | **PASS** | `browserSecrets.test.ts` |
| No lookahead (swings/BOS) | **PASS** | `noLookahead.test.ts` |

## Реальные Testnet closes (без секретов)

1. BTCUSDT LONG 0.002 · entry 77327.5 · exit 77177.5 · order `28567615142` · gross −0.30 · fees 0.1236 · **net −0.42** · funding **0**  
2. BTCUSDT LONG 0.002 · entry 77166.98 · exit 77137.5 · order `28567641532` · gross −0.059 · fees 0.1234 · **net −0.18** · funding **0**  
3. BTCUSDT LONG 0.002 · entry 77369.1 · exit 77368.1 · order `28567613072` · **net −0.09** (ранний flatten после protection)

## Что сознательно не закрыто этим коммитом

- **Live TP1→70% / TP2→40% / TP3→0% на бирже** — для min BTCUSDT лестница не ставится (фильтр LOT_SIZE). Нужен больший лот (≥0.003) или другая пара.
- **Paper soak 2–4 недели и Testnet soak несколько недель** — по времени не выполнены. Процесс `npm run dev` гонялся часами 2026-09-02, не недели. План: `ai-docs/reports/soak_24h.md`.
- **A+ статистически лучше A** — выборки закрытых сделок с grade недостаточно (см. `reports/strategy-validation.md`, A+=3).
- **Funding** — поле `order_history.fundingUsdt` есть, в формуле Net явно 0, пока нет funding worker.

## Safety (код + тесты)

- Kill switch flatten + unlock required  
- Daily loss / drawdown в RiskEngine  
- Existing position BLOCK (нет pyramiding)  
- Stale signal / stale market data BLOCK new auto trades  
- Idempotent `clientOrderId` на entry/close  
- `ALLOW_LIVE` default false  

## Как повторить

1. Ключи Demo: [demo.binance.com](https://demo.binance.com) API Management (Reading + Futures, без Withdrawal). Не Spot `testnet.binance.vision`.  
2. `npm run dev`  
3. Telegram: `/keys` → `/testorder` → `/testclose` или `/panic` → `/unlock`  
4. `npm test` · `npm run lint`
