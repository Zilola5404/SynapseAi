# Final QA — Testnet certification checklist

**Дата:** 2026-09-02  
**Среда:** Windows 10, Node v24.15.0, PostgreSQL 16.14 (`localhost:5433`), Binance Futures public REST `https://fapi.binance.com`  
**Режим всех пользователей в БД:** PAPER  
**Бот Telegram API:** `@SynapseTradeAgent_bot` (getMe HTTP 200, webhook пустой)  
**Правило:** статус ставится только по доказательствам. «Работает» без лога/теста = не PASS.

Доказательства: `ai-docs/reports/qa_evidence/live_evidence.json`, логи `[INTELLIGENCE]`, `/api/health` живого процесса.

| ID | Тест | Статус | Результат |
|---|---|---|---|
| QA-001 | Server boot / build | ⚠️ PARTIAL | `npm install` OK. `npm run build` PASS. `npm run lint` (`tsc --noEmit`) FAIL (11 ошибок TypeScript). Runtime unit-тесты PASS. |
| QA-002 | PostgreSQL | ✅ PASS | `npx prisma db push` после старта Docker. Ping `SELECT 1`. Таблица `trade_analysis` есть. 3 users. |
| QA-003 | Telegram | ⚠️ PARTIAL | API reachable, polling на уже запущенном процессе (`telegramPolling: true`). `/start` в этом сеансе вручную не нажимался. RU-клавиатура покрыта unit-тестом. Подписи кнопок отличаются от ТЗ. |
| QA-004 | Market Data | ✅ PASS | 3 символа × 5 ТФ, 0 ошибок. Retry/backoff при timeout доказан unit-тестом `marketData.test.ts` (процесс не падает). |
| QA-005 | Intelligence | ✅ PASS | Orchestrator вызывает `strategyEngine.analyzeBundle` → `evaluateIntelligence`. Живой лог `[INTELLIGENCE]` на BTCUSDT. |
| QA-006 | Signal | ⚠️ PARTIAL | Старые строки в `signals` (31.08) ещё `TREND_MOMENTUM` 72–74/100. Сегодня live-scan дал NO TRADE, новых A+ в БД нет. |
| QA-007 | NO TRADE | ✅ PASS | Live BTC: decision=NO_TRADE, score 4/15, Telegram-текст «СЕЙЧАС СДЕЛКУ НЕ ОТКРЫВАЕМ». `wouldSendBinanceOrder=false`. |
| QA-007A | Telegram consistency | ✅ PASS | VolumeEngine: weak/not confirm. Telegram не пишет «объём сильный». |
| QA-008 | Risk | ⚠️ PARTIAL | Unit-матрица блокирует kill/lock/daily/max pos/circuit/pause. В БД 31.08: `RISK_REJECT` ETHUSDT «Просадка 10.07% >= 8%». Live-кнопка panic в этом сеансе не нажималась. |
| QA-009 | Position Size | ⚠️ PARTIAL | При SL 5% и риске 0.5% от $1000 убыток у SL = $5. Узкий SL режется `max_margin`. Комиссия сверху (~$0.08) в risk amount не входит. |
| QA-010 | Binance Order | ❌ FAIL | Все аккаунты PAPER. В `.env` нет Binance ключей. Ордер на Futures Testnet в этом сеансе не отправлялся. Доказательства fill нет. |
| QA-011 | SL/TP | ⚠️ PARTIAL | PAPER-позиция имеет SL и TP в БД. На бирже не проверялось (PAPER). TP1/TP2/TP3 scale-out есть только в PAPER-коде, не в BinanceExecution. |
| QA-012 | Position Monitoring | ❌ FAIL | Worker heartbeat живой (`lastPosAt` сейчас), но OPEN PAPER BTCUSDT `updatedAt=2026-08-31 21:31:31`, `currentPrice=78966` при рынке ~76552. Цена не обновляется. |
| QA-013 | Position Close | ⚠️ PARTIAL | В `order_history`: STOP_LOSS pnl -7.54, fees 1.1977; несколько `KILL_SWITCH`. Закрытие в этом сеансе не проводилось. |
| QA-014 | Recovery | ⚠️ PARTIAL | Код recovery вызывается при boot. Второй `npm run dev` не открыл дубликат (lock + EADDRINUSE). Реконсиляция testnet-позиции не проверялась. |
| QA-015 | Kill Switch | ⚠️ PARTIAL | `evaluateRisk` блокирует. Исторические закрытия `KILL_SWITCH` в БД есть. Политика panic: scanner off, lock, cancel orders, close positions. Live panic сегодня не жали. |
| QA-016 | Security | ❌ FAIL | Dashboard пишет `apiKey`/`apiSecret` в `localStorage`. `server.ts` принимает секрет в query. Telegram-путь шифрует ключи AES-256-GCM. `.env` в git не попал. |
| QA-017 | Backtest | ⚠️ PARTIAL | MTF helper: `candlesAtOrBefore` не видит будущее (unit + live_evidence). Полный historical backtest с метриками в этом сеансе не гонялся. |
| QA-018 | Out of sample | ⚠️ PARTIAL | `threeWaySplit` train/validation/oos есть. Сравнение IS vs OOS на реальной истории не выполнено. |
| QA-019 | 24–72h soak | ❌ FAIL | Не выполнялся (нужны сутки непрерывной работы). |

## Детали по фазам

### QA-001 Build
- `npm install`: up to date, 339 packages, **5 high npm audit**.
- `npm run lint`: FAIL, вывод tsc сохранён в сессии. Часть ошибок старые (`logger.ts`, `aiService.ts`, `bot.ts`), часть от текущего кода.
- `npm run build`: PASS (vite 33s + esbuild `dist/server.cjs`).
- `npm run test:backend`: PASS, включая `[INTELLIGENCE]` на NO_TRADE.

### QA-002 Boot / DB
Уже работал процесс pid 27100. Повторный boot:

```
[BOOT] SynapseAI starting
[DB] PostgreSQL connected
[WORKERS] started
[TELEGRAM:FATAL] Another SynapseAI bot instance is already running
[HTTP:FATAL] Port 3000 already in use
```

Живой `/api/health` (pid 27100): `postgres=true`, `telegramPolling=true`, `marketDataHealthy=true`, `workers=true`, `recoveryReady=true`, `binanceWs=true`.

`npx prisma generate` — EPERM (DLL занят процессом). Схема в Postgres уже после `db push`.

### QA-003 Telegram
Ожидание ТЗ: кнопки «Запустить торговлю», «Экстренная остановка».  
Факт: reply «▶️ Старт» / inline «▶️ Запустить бота», panic «🚨 STOP», есть `/panic`.  
`/start` end-to-end в этом сеансе не снимался скриншотом.

getMe: `apiOk=true`, username `SynapseTradeAgent_bot`, webhook cleared.

### QA-004 Market data
15/15 запросов OK (BTC/ETH/SOL × 1d,4h,1h,15m,5m). REST: `https://fapi.binance.com` (не spot `api.binance.com`).  
Timeout: 3 retry + backoff, затем skip symbol, scanner не должен падать — unit PASS.

### QA-005–007 Intelligence / NO TRADE
Вызов: `TradingOrchestrator.scanOnce` / `runAutoCycle` → `strategyEngine.analyzeBundle` → `evaluateIntelligence`.

Живой лог 2026-09-02 13:45:

```
[INTELLIGENCE] symbol=BTCUSDT marketContext=NEUTRAL regime=TRENDING
structure=TRANSITION setup=NONE score=4 grade=NO_TRADE decision=NO_TRADE
volumeClass=WEAK volumeConfirms=false
```

Telegram preview совпадает с vetoes. Ордер не формируется.

QA-007 A+ на живом рынке **не найден** — это не провал NO TRADE, это отсутствие QUALITY SETUP в момент теста.

### QA-008 Risk
Матрица (`live_evidence.json`): kill switch, lock, scanner off, daily loss, max positions, circuit, pause — все `allowed: false`.  
История БД: ETHUSDT заблокирован по просадке.

### QA-009 Sizing
Equity $1000, risk 0.5% = $5.
- SL 5%: size $100, loss at SL $5
- SL 2%: size $250, loss $5
- SL 0.5%: size режется до $300 (max_margin), loss $1.50 < $5
- maxNotional $50: size $50, loss $1

Комиссия round-trip не вычитается из allowed risk заранее.

### QA-010 Testnet order
**Нет доказательства.** Пользователи: 3× PAPER. `BINANCE_API_KEY` в env пустой. `authenticated:false` на `/api/binance/ping`.

### QA-012 Monitoring
OPEN PAPER BTCUSDT LONG entry 78878.59, currentPrice 78966, updatedAt **2026-08-31 21:31:31**.  
Рынок на QA ~76552. Worker heartbeat идёт, цена позиции нет. Это блокер для «позиция реально отслеживается».

### QA-016 Security
- PASS: `.env` gitignored; в git нет значений секретов; DB `apiSecretEncrypted` в формате iv:tag:cipher.
- FAIL: `src/App.tsx` `localStorage.synapse_binance_config` хранит apiSecret; `server.ts` query `apiSecret`.
- F12 в браузере в этом сеансе не открывался; дефект виден в коде (dashboard). Telegram-бот ключи в localStorage не кладёт.

---

**Итог чеклиста:** полный цикл до Binance Testnet fill **не сертифицирован**. Intelligence + NO TRADE + DB + market data + risk unit — подтверждены.
