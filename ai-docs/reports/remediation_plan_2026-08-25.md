# Remediation Plan — SynapseAi

## Принцип

Идти строго по этапам ТЗ. Следующий этап разработки — Этап 1. Не закрывать и не расширять Этапы 2-6, пока нет БД, auth, encrypted credentials и audit trail.

## Milestone 0 — Repository hygiene

1. Подключить/инициализировать Git в `C:\01_Projects\SynapseAi`.
2. Проверить `.gitignore`: `.env`, `.env.local`, `dist`, logs, secrets.
3. Зафиксировать baseline проекта и `ai-docs`.

## Milestone 1 — Этап 1: DB + Security Foundation

1. Выбрать ORM: Prisma или Drizzle.
2. Добавить PostgreSQL и `DATABASE_URL`.
3. Создать миграции: `users`, `exchange_credentials`, `risk_settings`, `active_positions`, `order_history`, `system_logs`.
4. Реализовать JWT auth и middleware `requireAuth`.
5. Реализовать `encryptApiKey` / `decryptApiKey` на AES-256-GCM с `ENCRYPTION_KEY`.
6. Переделать Binance settings: клиент отправляет ключ один раз, сервер хранит encrypted, клиент получает только masked key.
7. Убрать Binance secret из `localStorage`, query params и обычных client request bodies.
8. Добавить тесты: secret не возвращается API, wrong encryption key не роняет сервер, unauthenticated requests отклоняются.

## Milestone 2 — Этап 2: Market Data Engine

1. Расширить Binance WS: ticker, kline 1m, depth10.
2. Добавить exponential backoff с cap/jitter.
3. Добавить ring buffer 500 свечей per symbol/timeframe.
4. Убрать конфликт SSE updates и `/api/market-data` fallback.
5. Считать RSI/MACD/ATR по реальным свечам.

## Milestone 3 — Этап 3: Hard Risk Engine

1. Встроить `validateOrderRisk` внутрь `/api/binance/order`.
2. Fail-closed: если risk недоступен, ордер не открывается.
3. Реализовать max drawdown.
4. Перенести SL/TP/trailing evaluation на backend.
5. Kill Switch: lock new orders, cancel open orders, close active positions, write `system_logs`, notify Telegram.

## Milestone 4 — Этап 4: Execution Engine

1. Server-side order manager.
2. Default environment: Binance Futures Testnet.
3. Primary order + STOP_MARKET + TAKE_PROFIT_MARKET.
4. Private user data stream `listenKey`.
5. Синхронизация fills/cancels/account updates в БД.
6. Fee model maker/taker в PnL.
7. Классификация Binance errors.

## Milestone 5 — Этап 5: AI Signal Loop

1. AI получает реальные 1m/15m/1h candles, indicators, orderbook, ATR.
2. Google Search Grounding входит в decision context.
3. JSON schema validation.
4. Invalid AI response -> HOLD + system log.
5. Backend chain: AI signal -> risk -> execution -> Binance.

## Milestone 6 — Этап 6: Monitoring/Deploy

1. Pino или Winston.
2. Structured logs в БД и stdout/file.
3. Telegram notifications на signal/order/TP/SL/kill/API errors.
4. Dockerfile + Compose: app, PostgreSQL, Redis.
5. Production `.env.example`.
6. DB backup.
7. 48h soak test на Binance Futures Testnet.

## Запрещенные shortcuts

- Не хранить секреты в браузере.
- Не открывать ордер без server risk approval.
- Не выдавать paper trading за live execution.
- Не считать UI labels `Stage` доказательством закрытого этапа ТЗ.
