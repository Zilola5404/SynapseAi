# Execution Certification — отчёт

Дата: 2026-09-02  
Цель: ANALYSIS → SIGNAL → RISK → SIZE → Binance Futures Testnet → FILLED → monitoring → SL/TP → CLOSE → PnL → Telegram.

## Что сделано в коде

### TASK 1 — секреты не в браузере
- `localStorage.synapse_binance_config` и `synapse_telegram_config` **удаляются при загрузке**.
- API Key / Secret / bot token **больше не пишутся** в LocalStorage / SessionStorage.
- `/api/binance/ping` и `/open-orders` **не принимают** `apiKey`/`apiSecret` из query.
- Ключи: Browser → API (POST verify или Telegram `/keys`) → Backend → Encrypted DB → Execution → Binance.
- Unit: `server/security/browserSecrets.test.ts` PASS.

Проверка вручную: F12 → Application → Local Storage / Session Storage — не должно быть `API_SECRET`, `API_KEY`, Binance Secret.

### TASK 2 — Testnet env
В `.env.example`:

```
BINANCE_TESTNET=true
BINANCE_USE_TESTNET=true
BINANCE_API_KEY=
BINANCE_API_SECRET=
```

Реальные ключи **не коммитятся** (`.gitignore`: `.env*`, исключение `.env.example`).

Health / ping используют **Futures** `getFuturesAccount`, не Spot.

### TASK 3 — ручной TEST ORDER
Telegram: `/testorder` или Настройки → **🧪 TEST ORDER**.  
Pipeline: TESTNET only → Risk Check (`source=manual`) → min BTCUSDT qty → MARKET → `[EXECUTION]` лог:

```
[EXECUTION] symbol side orderId clientOrderId status quantity avgPrice
```

Закрытие теста: `/testclose` (причина Manual Close).

### TASK 4 — Position monitoring
Источник цены:
1. Binance Position Risk API (`markPrice`, `positionAmt`, `unRealizedProfit`) для TESTNET/LIVE
2. WebSocket ticker
3. REST `/fapi/v1/ticker/price`

Каждый цикл пишет `currentPrice`, `quantity`, `entryPrice`, `sizeUsdt` → Prisma `@updatedAt` обновляется.

WS: last price сидируется из klines, если ticker пустой.

### TASK 5 — Reconciliation
Каждые **30 секунд**: DB ↔ Binance.
- DB OPEN + exchange FLAT → `RECONCILE` close
- Quantity / entry mismatch → SYNC

### TASK 6 / 7 — SL и TP на бирже
После FILLED:
- SL: `STOP_MARKET` + `closePosition=true` (остаток после частичного TP всё ещё защищён)
- TP: 30% / 30% / 40%, если лот позволяет 3 ноги; иначе один TP (min BTC 0.001 нельзя нарезать)

После TP1: позиция OPEN, SL остаётся (closePosition).

### TASK 8 — Telegram карточка
`💼 ОТКРЫТАЯ СДЕЛКА` — направление, размер, вход, текущая цена, PnL $ и %, SL, TP1/TP2/TP3.

### TASK 9 — Close + PnL
`🔒 СДЕЛКА ЗАКРЫТА` + причина + PnL + комиссии + итог.  
`/testclose` → Manual Close.

### TASK 10 — Kill Switch
Политика (`KILL_SWITCH_POLICY`): scanner off, новые ордера блок, open orders cancel, **позиции flatten на бирже**, lock до `/unlock`.  
Unit: `killSwitchPolicy.test.ts` PASS.  
Runtime: `/panic` после открытого TESTNET ордера.

### TASK 11 — lint
`npm run lint` → **EXIT 0**

### TASK 12 — 24h soak
Не выполнен в этой сессии (нужны 24 часа живого процесса).  
План: держать `npm run dev` на TESTNET, смотреть `/api/health` (workers, ws, `binanceAuthenticated`), memory, Telegram polling, reconnect, `updatedAt` позиций.

## Acceptance (честно)

| # | Критерий | Статус |
|---|----------|--------|
| 1 | `npm run build` PASS | **PASS** |
| 2 | `npm run lint` PASS | **PASS** |
| 3 | Binance Testnet `authenticated = true` | **НЕ доказано** — в `.env` нет `BINANCE_API_KEY` / `SECRET` |
| 4 | Real Testnet Order FILLED | **НЕ доказано** — нет ключей, ордер не отправлялся |
| 5 | Real Position на Binance | **НЕ доказано** |
| 6 | Position monitoring обновляет цену/PnL | Код готов; live 30–60s тест нужен после ключей |
| 7 | SL exists on exchange | Код готов; нет fill → нет ордера на бирже |
| 8 | TP execution tested | Unit 30/30/40 PASS; live TP не гонялся |
| 9 | Close tested | PAPER/unit есть; Testnet close нет |
| 10 | Telegram real PnL | Шаблон готов; нет live fill |
| 11 | Kill Switch runtime | Политика + `/panic` код; live flatten не гонялся |

## Как закрыть пункты 3–10 у себя

1. Ключи [Binance Demo Trading](https://demo.binance.com/) (или legacy [testnet.binancefuture.com](https://testnet.binancefuture.com/)) в `/keys` или локальный `.env` (не в git):

```
BINANCE_TESTNET=true
BINANCE_API_KEY=...
BINANCE_API_SECRET=...
```

2. Перезапуск сервера. `/health` → `binanceAuthenticated: true` или Telegram статус: `authenticated = true`.
3. Telegram: `/keys` (те же ключи в encrypted DB) → режим TESTNET → `/testorder`.
4. В логах сервера блок `[EXECUTION]` с `orderId` / `status=FILLED`.
5. Подождать 30–60 с, `/positions` — цена и `updatedAt`.
6. На testnet.binancefuture.com: позиция + STOP_MARKET.
7. `/testclose` или `/panic` (kill switch).

## Live probe 2026-09-02 17:36 UTC+3

Скрипт `scripts/live-execution-cert.ts` (`AUTH_ONLY=1`):

- Часы: offset ≈ **+10 с** к Binance; `-1021` закрыт (time sync + `recvWindow=60000`)
- REST: `demo-fapi.binance.com` и `testnet.binancefuture.com` отвечают; ключи `uGCh...W0T` на обоих → **`-2015` Invalid API-key, IP, or permissions**
- `/api/health`: `binanceAuthenticated: false`, Telegram polling **ON**, workers **ON**, BTC mark **77111.5**
- Lint: `tsc --noEmit` **PASS**
- Browser secrets unit: **PASS**

FILLED / позиция / SL на бирже / Telegram PnL / kill-switch runtime — **не доказаны**. Нужны ключи Demo Trading с [demo.binance.com](https://demo.binance.com); Key и Secret копировать отдельно.

