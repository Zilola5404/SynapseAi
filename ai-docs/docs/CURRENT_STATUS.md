# Current Status — SynapseAi

**Дата последнего обновления:** 25.08.2026  
**Обновил:** Codex / Senior Architect

## 1. Одно предложение о проекте

SynapseAi сейчас является demo/MVP-прототипом AI crypto trading dashboard, тогда как ТЗ требует production trading system с PostgreSQL, JWT, AES-256-GCM, hard risk engine, Binance Futures execution, мониторингом и deploy-контуром.

## 2. Текущий этап

- [x] Discovery / audit
- [x] MVP demo-прототип
- [ ] MVP на тестировании
- [ ] Production подготовка
- [ ] Production поддержка

Формально по ТЗ проект должен начинать с Этапа 1. Этап 1 не закрыт.

## 3. Что уже реализовано

- React/Vite SPA dashboard и лендинг.
- Express server в `server.ts`.
- Binance public REST: klines, orderbook, market-data fallback.
- Binance signed REST-заготовки: account, order, cancel, open orders.
- Binance public ticker WebSocket -> SSE `/api/binance/stream`.
- Серверная функция `validateOrderRisk` с частью risk-фильтров.
- Gemini AI endpoint `/api/ai-analysis` с fallback-алгоритмом.
- Google Search Grounding используется в `/api/market-news`.
- Telegram send/test endpoints.
- Health endpoints `/api/health` и `/api/system/health`.
- `npm run lint` проходит без ошибок.
- `npm run build` проходит, но есть предупреждение о большом frontend bundle.

## 4. Что не реализовано по production-ТЗ

- PostgreSQL и ORM Prisma/Drizzle.
- Миграции `users`, `exchange_credentials`, `risk_settings`, `active_positions`, `order_history`, `system_logs`.
- JWT-auth и server-side session model.
- AES-256-GCM encryption/decryption API-ключей.
- Маскирование ключей на API boundary.
- Персистентные позиции, ордера, логи и настройки риска.
- Серверная принудительная проверка риска внутри `/api/binance/order`.
- Binance SL/TP algo orders, server trailing stop, user data stream `listenKey`.
- Redis/in-memory кеш 500 свечей.
- Production logging Winston/Pino.
- Docker/Docker Compose/PostgreSQL/Redis deployment.
- Unit/integration/e2e/security/performance tests и CI/CD.

## 5. Активная задача

`AUDIT-2026-08-25` — аудит соответствия ТЗ и адаптация `ai-docs` под проект. Статус: документация обновлена, код приложения не менялся.

## 6. Известные проблемы / блокеры

| ID | Приоритет | Проблема | Влияние |
|---|---|---|---|
| BL-001 | P0 | API Key/Secret хранятся в `localStorage` | Риск утечки секретов |
| BL-002 | P0 | `/api/binance/order` не вызывает `validateOrderRisk` | Hard risk engine можно обойти |
| BL-003 | P0 | Auth является клиентской имитацией | Нет users/JWT/access control |
| BL-004 | P1 | AI автоторговля не идет через execution engine | Нет цепочки AI -> Risk -> Binance |
| BL-005 | P1 | Нет БД и миграций | Нет production persistence и audit trail |
| BL-006 | P1 | SL/TP не выставляются на Binance | Risk-control только локальный |
| BL-007 | P1 | Нет тестов и CI/CD | Нельзя безопасно развивать trading system |
| BL-008 | P2 | `.git` в папке проекта не обнаружен | Нет истории и контроля изменений |

## 7. Последние важные решения

- 25.08.2026 — статус проекта считать demo/MVP, не production.
- 25.08.2026 — следующий технический этап по ТЗ: только Этап 1.
- 25.08.2026 — `ai-docs` является источником правды для следующих ИИ-агентов.

## 8. Ссылки

- Дашборд: `ai-docs/ai/DASHBOARD.md`
- Аудит ТЗ: `ai-docs/reports/audit_tz_compliance_2026-08-25.md`
- Реестр документов: `ai-docs/ai/DOCUMENT_REGISTRY.md`
