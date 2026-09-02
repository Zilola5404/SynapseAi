# Final bug report — SynapseAI QA 2026-09-02

Статусы: OPEN / FIXED. Severity: CRITICAL / HIGH / MEDIUM / LOW.

---

## BUG-001
**Название:** `npm run lint` (`tsc --noEmit`) не проходит  
**Severity:** HIGH  
**Как повторить:** `npm run lint`  
**Expected:** 0 ошибок TypeScript  
**Actual:** 11 ошибок (logger execSync encoding, swings comparison, aiService/credentialService discriminated union, grammy UserFromGetMe, orchestrator LIVE comparison, PaperExecution.placeProtection в тесте, и др.)  
**Fix:** Не исправлялись все старые ошибки в этом этапе (QA без большого рефакторинга). Часть новых (intelligence test btc context, reduceOnly, tradeAnalysis cast) поправлена.  
**Status:** OPEN

## BUG-002
**Название:** `prisma generate` EPERM на Windows, пока запущен `npm run dev`  
**Severity:** MEDIUM  
**Как повторить:** держать `tsx server.ts`, выполнить `npx prisma generate`  
**Expected:** клиент генерируется  
**Actual:** rename `query_engine-windows.dll.node` → EPERM  
**Fix:** останавливать dev перед generate. `db push` при этом проходит.  
**Status:** OPEN (ограничение среды)

## BUG-003
**Название:** Dashboard хранит Binance apiSecret в localStorage открытым текстом  
**Severity:** CRITICAL (для web-dashboard; Telegram-путь использует шифрование)  
**Как повторить:** `src/App.tsx` `handleSaveBinanceConfig` → `localStorage.setItem('synapse_binance_config', JSON.stringify(config))`  
**Expected:** секреты только на сервере, encrypted  
**Actual:** apiKey + apiSecret в браузере  
**Fix:** не делать в этом QA-этапе (запрет новых фич). Нужно убрать сохранение секрета на клиенте.  
**Status:** OPEN

## BUG-004
**Название:** Binance secret можно передать query-параметром HTTP API  
**Severity:** HIGH  
**Как повторить:** `GET /api/binance/ping?apiSecret=...` (`server.ts`)  
**Expected:** секреты только в body/header, не в URL/логах  
**Actual:** `req.query.apiSecret`  
**Fix:** не делался в QA-этапе.  
**Status:** OPEN

## BUG-005
**Название:** Нет доказательства ордера на Binance Futures Testnet  
**Severity:** CRITICAL для сертификации Testnet (не обязательно баг кода)  
**Как повторить:** QA-010: все users.tradingMode=PAPER, env ключи пустые  
**Expected:** Signal → risk → testnet order → fill  
**Actual:** цикл на бирже не запускался  
**Fix:** TESTNET ключи + явный ручной ордер в следующем этапе.  
**Status:** OPEN

## BUG-006
**Название:** Частичное закрытие TP1/TP2/TP3 только в PAPER  
**Severity:** HIGH  
**Как повторить:** код `scaleOutPaper` vs `BinanceExecution.placeProtection` (один TP)  
**Expected:** на testnet после TP1 остаток позиции и живой SL  
**Actual:** биржа получает один TP на весь объём  
**Fix:** не делался (не ломать execution в QA).  
**Status:** OPEN

## BUG-007
**Название:** PAPER-позиция не обновляет currentPrice, хотя Position Worker жив  
**Severity:** HIGH  
**Как повторить:** `active_positions` BTCUSDT OPEN, `updatedAt=2026-08-31 21:31:31`, `currentPrice=78966`; рынок QA ~76552; `/api/health` lastPosAt свежий  
**Expected:** цена и PnL обновляются каждые ~3с  
**Actual:** stale 2 дня  
**Fix:** не чинился в этом этапе — нужен разбор `binanceWsManager.getPrice` / фильтр статуса.  
**Status:** OPEN

## BUG-008
**Название:** Risk amount не включает комиссии  
**Severity:** MEDIUM  
**Как повторить:** equity 1000, risk 0.5%, SL 5% → loss at SL $5, round-trip fee ~$0.08, итог ~$5.08  
**Expected:** убыток с комиссией ≤ allowed risk  
**Actual:** fee сверху  
**Status:** OPEN

## BUG-009
**Название:** Подписи Telegram не совпадают с ТЗ QA  
**Severity:** LOW  
**Expected:** «Запустить торговлю», «Экстренная остановка»  
**Actual:** «▶️ Старт» / «▶️ Запустить бота», panic «🚨 STOP», команда `/panic` есть  
**Status:** OPEN

## BUG-010
**Название:** npm audit: 5 high severity  
**Severity:** MEDIUM  
**Как повторить:** `npm install`  
**Status:** OPEN

## BUG-011
**Название:** Журнал `trade_analysis` пустой  
**Severity:** LOW  
**Как повторить:** `SELECT COUNT(*) FROM trade_analysis` → 0. Старая PAPER-сделка открыта до движка journal.  
**Status:** OPEN

## BUG-012
**Название:** 24–72h soak не проводился  
**Severity:** HIGH для допуска к длительному testnet  
**Status:** OPEN (не выполнялся)

---

Не баги, а наблюдения:
- Live BTC 2026-09-02: NO_TRADE 4/15 — ожидаемое строгое поведение.
- Второй `npm run dev` корректно отказался из-за lock/порта — защита от дубля polling.
