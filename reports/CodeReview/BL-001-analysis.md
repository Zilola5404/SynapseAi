# BL-001 — Аудит кода относительно ТЗ

**Дата:** 2026-08-14  
**Источник требований:** `Техническое Задание.docx`  
**Объект:** текущий код SynapseAi (frontend `src/`, backend `server.ts` + `server/`)  
**Режим:** только анализ, код не менялся  
**Статус документа:** ожидает подтверждения перед любыми правками

---

## 1. Вердикт

Текущий проект — **демо-прототип UI + набор REST-обёрток**, а не production-версия из ТЗ.

Комментарии в коде (`STAGE 1` … `STAGE 6`) **не соответствуют этапам ТЗ**. Это внутренняя нумерация прототипа. По регламенту ТЗ этапы идут строго по порядку, следующий этап — только после закрытия багов предыдущего.

**Этап 1 ТЗ (БД, JWT, шифрование ключей) не начат.**  
Пока он не закрыт, этапы 2–6 по регламенту ТЗ считать выполненными нельзя, даже если отдельные куски уже есть в прототипе.

Итоговая оценка готовности к production по ТЗ: **~15–20%**.  
Готовность как интерактивного демо: **высокая** (лендинг, дашборд, модалки, симуляция торговли).

---

## 2. Что есть сейчас (as-is)

```
SynapseAi/
  server.ts              Express + Vite middleware, все API в одном файле
  server/binance.ts      HMAC REST-клиент Binance (spot/futures, testnet)
  server/websocket.ts    публичный ticker WS → SSE
  server/risk.ts         чистые функции валидации риска (не вшиты в ордер)
  server/telegram.ts     sendMessage / test
  src/App.tsx            весь торговый стейт в React (localStorage)
  src/components/*       UI дашборда, модалки, лендинг
  src/data/initialData.ts стартовые mock-позиции, сделки, логи, метрики
```

**Нет в репозитории:** PostgreSQL, Prisma/Drizzle, Redis, JWT, AES-256-GCM, Docker, Winston/Pino, официальный `@binance/futures-connector`, user data stream (`listenKey`).

Состояние торгового мира живёт **только в памяти браузера**. Перезагрузка страницы возвращает mock из `initialData.ts` (кроме ключей Binance/Telegram и «пользователя» в `localStorage`).

---

## 3. Матрица ТЗ: сделано / частично / не сделано

Легенда: **DONE** — соответствует ТЗ; **PARTIAL** — есть заготовка, критерии приёмки не закрыты; **WRONG** — сделано, но против ТЗ или ломает контракт; **MISSING** — нет.

### Этап 1 — Серверный фундамент, БД и безопасность

| Требование ТЗ | Статус | Где смотреть | Комментарий |
|---|---|---|---|
| PostgreSQL + Prisma/Drizzle | MISSING | — | ORM и БД отсутствуют |
| Таблица `users` + JWT | WRONG | `src/components/AuthModal.tsx` | Логин/регистрация пишут `{email, name}` в `localStorage`. Пароль никуда не уходит. OAuth Google/Telegram — `setTimeout` с демо-юзером |
| `exchange_credentials` + AES-256-GCM | WRONG | `src/App.tsx` (~68–85, 190–194), `BinanceSettingsModal.tsx` | Ключ и секрет хранятся **открытым текстом** в `localStorage` (`synapse_binance_config`) и уходят на сервер в body/query |
| Маска ключа в API (`vmX9...4aZ`) | MISSING | `server.ts` ping/order/open-orders | Ключи принимаются и могут светиться в query (`/api/binance/ping`, `/api/binance/open-orders`) |
| `encryptApiKey` / `decryptApiKey` + `ENCRYPTION_KEY` | MISSING | — | Утилиты нет |
| Таблицы risk / positions / orders / logs | MISSING | `src/App.tsx` state | Всё в React state |
| Миграции БД | MISSING | — | |
| Lint / typecheck без дыр безопасности | PARTIAL | `package.json` `lint: tsc --noEmit` | Скрипт есть, `strict` в tsconfig нет, проверки утечек ключей нет |

**Критерии приёмки этапа 1: не выполнены (0/3).**

### Этап 2 — Живые рыночные данные

| Требование ТЗ | Статус | Где смотреть | Комментарий |
|---|---|---|---|
| WS `wss://stream.binance.com:9443/ws` | PARTIAL | `server/websocket.ts` | Подключение есть, только `@ticker` |
| Поток `<symbol>@kline_1m` | MISSING | `TradingChart.tsx` | Свечи через REST `/api/binance/klines` раз в 10 с, не WS |
| Поток `<symbol>@depth10` | PARTIAL | `server/binance.ts` `fetchBinanceOrderBook` | REST depth, не WS; в UI стакан как live-поток не показан |
| Auto-reconnect + exponential backoff | WRONG | `server/websocket.ts` ~114–119 | Фиксированные 5 с, не экспонента |
| Кеш 500 свечей в памяти/Redis | MISSING | — | Индикаторы считаются на лету от REST-ответа |
| График = живые котировки, лаг < 100 мс | PARTIAL | `TradingChart.tsx`, `App.tsx` SSE | Цена тикера приходит по SSE; сам график — REST + fallback-синтетика. RSI на всех свечах один и тот же. MACD = `close - ema20`, это не MACD |
| Восстановление без потери истории свечей | MISSING | — | Истории на сервере нет |

**Критерии приёмки этапа 2: не выполнены.**

Дополнительно: в `App.tsx` два конкурирующих источника цены. SSE (`/api/binance/stream`) обновляет `assets`, и каждые 2 с `fetchMarketData()` **перезаписывает** весь массив из `/api/market-data`. Там RSI/MACD/сентимент считаются формулами от `change24h` и `Math.sin(price)`, а не от свечей.

### Этап 3 — Hard Risk Engine

| Требование ТЗ | Статус | Где смотреть | Комментарий |
|---|---|---|---|
| Серверный фильтр max risk / leverage / positions / daily loss | PARTIAL | `server/risk.ts` `validateOrderRisk` | Функция написана правильно по смыслу, **но не вызывается** из `/api/binance/order` |
| Max drawdown | WRONG | `server/risk.ts` | Поле есть в settings, **проверки нет**. Баннер на клиенте только рисует предупреждение, ордера не стопит |
| Блок новых ордеров до Binance | WRONG | `server.ts` ~136–170 | `/api/binance/order` сразу вызывает `placeBinanceOrder`. Risk-check — отдельный endpoint, клиент может его обойти |
| Kill Switch: блок автоторговли + закрытие позиций на рынке | PARTIAL | `server.ts` kill-switch, `App.tsx` `handleTriggerKillSwitch` | Клиент закрывает **локальные** позиции. Сервер только `cancel` открытых ордеров, **позиции на бирже не закрывает** |
| Фиксация Kill Switch в системных логах | PARTIAL | `console.warn` + UI-лог | Нет серверного audit-лога / БД |

Баги реализации риска:

1. Автоскан AI открывает позицию **без** `/api/binance/risk-check` и **без** `/api/binance/order` (`App.tsx` ~441–494). Лимит позиций захардкожен `positions.length < 5`, а не `risk.maxOpenPositions` (по умолчанию 3).
2. Ручной ордер: при ошибке сети risk-check **проглатывается** (`catch` → `console.warn` → ордер всё равно открывается).
3. `evaluatePositionEmergency` в `server/risk.ts` **нигде не вызывается**. SL/TP/trailing живут только в `setInterval` на клиенте.
4. Баннер просадки (`EmergencyRiskBanner`) показывает «ТОРГОВЛЯ ЗАБЛОКИРОВАНА», но `emergencyKillSwitch` при этом может быть `false` — автоскан продолжает работать.
5. `handleResetKillSwitch` обнуляет `realizedPnL24h` и включает автоторговлю — это обход дневного лимита одной кнопкой.

**Критерии приёмки этапа 3: не выполнены.** Тест «10 позиций при лимите 3» на серверном ордер-пути сейчас не работает, потому что ордер-путь риск не проверяет.

### Этап 4 — Execution Engine

| Требование ТЗ | Статус | Где смотреть | Комментарий |
|---|---|---|---|
| Подписанный REST (HMAC SHA256) | DONE | `server/binance.ts` `createBinanceSignature` | Реализация подписи корректна |
| Официальный `@binance/futures-connector` | MISSING | `package.json` | Свой fetch-клиент |
| Market/Limit Spot и Futures Testnet | PARTIAL | `placeBinanceOrder` | Вызов есть; при отсутствии ключей **тихо** уходит в paper с `status: FILLED` |
| STOP_MARKET + TAKE_PROFIT_MARKET вместе с ордером | MISSING | `ManualTradeModal.tsx`, `binance.ts` | SL/TP только числа в React-стейте, на биржу не ставятся |
| Серверный trailing stop | WRONG | `App.tsx` ~299–309, `risk.ts` 132–151 | Только клиент; функция на сервере мертвая |
| User Data Stream `listenKey` | MISSING | — | Синхронизации fill/cancel/balance с биржей нет |
| Обновление позиции в БД при TP на бирже | MISSING | — | БД нет |
| Обработка `-1021 timestamp`, `-2010 margin`, rate limit | MISSING | `placeBinanceOrder` | Любая ошибка Binance → throw/500, без классификации |
| Комиссии maker/taker в PnL | MISSING | — | |

Критичный баг paper-режима: если ключей нет и тип `MARKET`, цена исполнения = **50000**, а не рыночная (`binance.ts` ~328). Ручной MARKET не передаёт `price` → бумажный BTC-ордер наполняется по 50 000 при реальной цене ~94 000.

**Критерии приёмки этапа 4: не выполнены.**

### Этап 5 — AI-агент и Google Search Grounding

| Требование ТЗ | Статус | Где смотреть | Комментарий |
|---|---|---|---|
| Промпт Gemini со срезом рынка | PARTIAL | `server.ts` `/api/ai-analysis` | Свечи в автоскане — это `sparkline`, не 1m/15m/1h OHLCV. ATR в промпт не передаётся |
| Google Search Grounding по монете сигнала | PARTIAL | `/api/market-news` | Grounding есть у новостного эндпоинта, **не** у `/api/ai-analysis` |
| Строгий JSON + валидация полей | PARTIAL | `server.ts` ~590–607 | `JSON.parse` без схемы. Нет проверки диапазонов SL/TP/side |
| `confidence < threshold` → сигнал отбрасывается | PARTIAL | fallback-движок да, путь Gemini — нет повторной серверной проверки | Порог проверяется ещё раз на клиенте |
| Цепочка AI → Risk → Execution → Binance | WRONG | `App.tsx` `runAiAnalysisScan` | Цепочка: AI → локальный `setPositions`. Биржа и серверный риск не участвуют |
| Устойчивость к битому JSON / галлюцинации | PARTIAL | fallback quant-engine | Сервер не падает, но «сброс сигнала + warning в журнал» как audit-событие не пишется |
| `AIDecisionModal` | WRONG | `AIDecisionModal.tsx` | Решение рисуется с клиента по RSI/change, **без** вызова `/api/ai-analysis`. История сделок в модалке захардкожена |

**Критерии приёмки этапа 5: не выполнены.**

### Этап 6 — Мониторинг, уведомления, деплой

| Требование ТЗ | Статус | Где смотреть | Комментарий |
|---|---|---|---|
| Winston/Pino, файл + сервис | MISSING | — | `console.log` / `console.warn` |
| Telegram: сигнал, ордер, TP/SL, Kill Switch, ошибки API | PARTIAL | `server/telegram.ts`, `App.tsx` | Отправка работает. Реально вызывается **только** на Kill Switch и его сброс. Сигналы, ордера, TP/SL, ошибки API в Telegram не уходят |
| Docker / Compose (Node + Postgres + Redis) | MISSING | — | |
| Production `.env` | PARTIAL | `.env.example` | Ключи описаны, окружение деплоя не собрано |
| Backup БД | MISSING | — | БД нет |
| 48 часов на Futures Testnet без сбоя | MISSING | — | Нечем измерять: нет персистентности и реального execution-контура |

**Критерии приёмки этапа 6: не выполнены.**

---

## 4. Где сделано правильно

Это заготовки, которые можно сохранить. Архитектуру менять не нужно — их надо **довести и встроить**, а не переписывать с нуля.

1. **HMAC SHA256 для Binance** (`server/binance.ts`) — каноничный query + signature + `X-MBX-APIKEY`. Это правильная база Execution Engine.
2. **Разделение testnet/mainnet и spot/futures URL** (`getBinanceBaseUrl`) — соответствует требованию первичной отладки на Binance Futures Testnet.
3. **Публичный ticker WS + SSE** (`server/websocket.ts` → `/api/binance/stream`) — верное направление для этапа 2 (сервер владеет сокетом, клиент не ходит на Binance напрямую).
4. **Набор правил `validateOrderRisk`** — kill switch, daily loss, max positions, leverage, position size. Логика фильтров совпадает с ТЗ; проблема в том, что она не стоит перед ордером.
5. **Индикаторы RSI/EMA/ATR от OHLCV** (`calculateIndicators`) — правильное место (сервер). Сами формулы упрощены (RSI не Wilder), но точка расчёта верная.
6. **Order book imbalance** считается по notional bids/asks — разумная метрика для промпта AI.
7. **Telegram Bot API** (`sendTelegramMessage`) — корректный тонкий клиент; не хватает вызовов из бизнес-событий.
8. **Новости с Google Search Grounding + in-memory cache 10 мин** — правильный паттерн для этапа 5/6, его нужно подключить к сигнальному контуру, а не только к виджету.
9. **UI-контракт риска и стратегии** (`types.ts`: `RiskSettings`, `StrategySettings`, `Position`) — поля совпадают с языком ТЗ. Их можно маппить в будущие таблицы БД без ломки UI.
10. **Health endpoints** `/api/health`, `/api/system/health` — заготовка мониторинга.

---

## 5. Где сделано неправильно (дефекты, не «ещё не сделано»)

Приоритет: P0 ломает безопасность или деньги; P1 ломает критерии ТЗ; P2 ломает UX/типы.

### P0 — безопасность и деньги

| ID | Суть | Почему это против ТЗ |
|---|---|---|
| P0-1 | API Key + Secret в `localStorage` и в теле/query запросов | ТЗ: ключи только на сервере, AES-256-GCM, клиент видит маску |
| P0-2 | `/api/binance/order` не вызывает `validateOrderRisk` | ТЗ: блок **до** обращения к Binance |
| P0-3 | Автоторговля открывает позиции только в React state, но `autoTradeEnabled: true` по умолчанию | Создаёт иллюзию live-торговли; при появлении ключей легко включить опасный путь без серверного фильтра |
| P0-4 | Auth — фейк. Любой email+пароль ≥ 6 символов «входит» | ТЗ: JWT + таблица users |
| P0-5 | Лендинг обещает AES-256 / KMS / «ключи не в браузере» | Прямо противоречит коду. FAQ также говорит, что торговые права на API не нужны, при этом UI шлёт ордера |

### P1 — ложная реализация требований

| ID | Суть |
|---|---|
| P1-1 | Paper fallback маскируется под успешный биржевой ордер (`isPaperTrade` легко не заметить в логах UI) |
| P1-2 | Paper MARKET fill @ 50000 |
| P1-3 | SL/TP не выставляются на Binance |
| P1-4 | Kill Switch не закрывает биржевые позиции |
| P1-5 | `evaluatePositionEmergency` мёртвый код |
| P1-6 | AI-скан не ходит в execution и risk |
| P1-7 | Свечной график: один RSI на все бары, фейковый MACD, сигналы BUY/SELL прибиты к фиксированным индексам свечей |
| P1-8 | `/api/market-data` генерирует RSI/MACD/sparkline, затирая live SSE |
| P1-9 | Backtest: и клиент (`BacktestSimulatorModal`), и сервер (`/api/backtest/run`) возвращают **зашитые числа**, не расчёт по истории. Модалка сервер даже не вызывает |
| P1-10 | `AIDecisionModal` не вызывает AI API; `onExecuteTrade` передаёт `BUY`/`SELL`, а `handleOpenManualPosition` ждёт `LONG`/`SHORT` → риск-чек и ликвидация считаются как SHORT |
| P1-11 | Онбординг пишет `maxRiskPerTradePct`, `maxDailyDrawdownPct`, `confidenceThreshold` — полей нет в `RiskSettings`/`StrategySettings`. Калибровка профиля **не применяется** |
| P1-12 | Reconnect WS без backoff; нет kline/depth streams; нет кеша 500 свечей |

### P2 — контракты и качество

| ID | Суть |
|---|---|
| P2-1 | `addLog({ level: 'SUCCESS' })` — такого литерала нет в `AgentLog` |
| P2-2 | `setStats({ totalBalanceUsdt })` — поля нет в `PortfolioStats` |
| P2-3 | `tsconfig` без `strict` / `noImplicitAny` |
| P2-4 | Начальные позиции и сделки в `initialData.ts` выглядят как реальный портфель |
| P2-5 | Telegram-настройки `notifyOnSignals/Orders/StopLoss` не используются (кроме kill switch) |
| P2-6 | `handleToggleAutoTrade` при активном kill switch **сбрасывает** kill switch |

---

## 6. Что осталось сделать (по этапам ТЗ)

Регламент ТЗ: **один этап за раз**. Ниже — объём, не план работ в этом шаге.

### Этап 1 (следующий обязательный) — не начат

- Поднять PostgreSQL + ORM (Prisma или Drizzle — выбрать один и не менять дальше).
- Миграции: `users`, `exchange_credentials`, `risk_settings`, `active_positions`, `order_history`, `system_logs`.
- JWT auth (регистрация/логин), убрать фейковый `AuthModal` backend.
- `encryptApiKey` / `decryptApiKey` (AES-256-GCM, ключ из env).
- Сохранение ключей только на сервере; в клиент — маска.
- Убрать ключи из `localStorage` и из query-параметров.
- Прогон: DevTools не показывает secret; неверный `ENCRYPTION_KEY` не роняет процесс.

### Этап 2 — довести, не переписывать с нуля

- Добавить WS-потоки kline и depth.
- Exponential backoff.
- In-memory (затем Redis) кольцевой буфер 500 свечей.
- Убрать конфликт SSE vs `/api/market-data`.
- Считать RSI/MACD/ATR по кешу свечей, а не по `change24h`.

### Этап 3 — встроить уже написанный `risk.ts`

- Вызов `validateOrderRisk` внутри `/api/binance/order` (и AI-цепочки) **до** Binance.
- Реализовать max drawdown на сервере.
- Kill Switch: cancel + market close всех позиций, запись в `system_logs`.
- Убрать client-side bypass в `catch`.

### Этап 4 — довести `binance.ts`

- SL/TP как биржевые algo-ордера.
- `listenKey` user stream → синхронизация стейта/БД.
- Убрать скрытый paper-fill @ 50000 из production-пути (paper — явный режим).
- Классификация ошибок Binance.

### Этап 5 — связать контур

- В AI передавать реальные 1m/15m/1h + индикаторы + стакан + новости по символу.
- JSON-схема ответа.
- Цепочка строго: signal → risk → order → Binance.
- Модалка решения должна звать тот же `/api/ai-analysis`.

### Этап 6

- Pino/Winston.
- Telegram на все события из ТЗ.
- Docker Compose: app + Postgres + Redis.
- Backup, 48h прогон на Futures Testnet.

---

## 7. Расхождение продукта и ТЗ (важно не сломать архитектуру)

ТЗ описывает **автономного торгового робота** (AI → риск → Binance).

Лендинг (`LandingPage.tsx` FAQ) описывает другой продукт: AI Portfolio Management **без** авто-исполнения, API только read-only.

Код ближе к ТЗ (есть `autoTradeEnabled`, `/api/binance/order`), маркетинг — к «сигналам без торговли». Это не баг реализации этапа, но конфликт требований. По правилу «работать строго по документации» ориентир — **ТЗ**, не FAQ лендинга. FAQ на этапе 1 править не обязательно, но противоречие зафиксировать.

Окружение отладки по ТЗ: **Binance Futures Testnet**. В UI дефолт `tradingType: 'SPOT'`. Это нужно будет выровнять на этапе 4, не раньше.

---

## 8. Рекомендация после подтверждения

По регламенту ТЗ следующий шаг работ — **только Этап 1**:

1. БД + ORM + миграции таблиц из п. 1.1.
2. JWT-пользователи.
3. AES-256-GCM для ключей биржи, маска на клиенте, удаление секретов из `localStorage`.

Не делать в том же заходе: рефакторинг UI, «настоящий» backtest, Docker, перепись AI. Это другие этапы.

Прототипный UI (`src/components/*`) оставлять как оболочку. Менять только точки сохранения ключей/сессии, когда появится API этапа 1.

---

## 9. Файлы, которые нельзя считать «готовым этапом»

| Файл | Как подписан в коде | Фактический статус по ТЗ |
|---|---|---|
| `server.ts` STAGE 1 API | «Binance Stage 1» | Публичные REST-обёртки, не фундамент ТЗ |
| `server.ts` STAGE 2 order routes | Execution | Ордера без risk-guard и без SL/TP на бирже |
| `server.ts` STAGE 3 risk-check / kill-switch | Hard Risk | Эндпоинт есть, в execution не встроен |
| `server.ts` STAGE 5 health / backtest | Monitoring | Health — ок как заготовка; backtest — заглушка |
| `server/telegram.ts` «Stage 6» | Уведомления | Транспорт есть, событийная шина нет |

---

**Остановка по инструкции: код не менялся. Жду подтверждения, чтобы переходить к Этапу 1 ТЗ.**
