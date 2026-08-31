# Defects and Risks — SynapseAi Audit 2026-08-25

## P0 / Blocker

| ID | Категория | Дефект/риск | Доказательство | Рекомендация |
|---|---|---|---|---|
| BL-001 | Security | Binance API Key/Secret сохраняются в браузере | `src/App.tsx:76-84`, `190-194`; `BinanceSettingsModal.tsx:103-109` | Server-side encrypted credentials vault |
| BL-002 | Security/API | Secret передается из клиента в backend body/query | `BinanceSettingsModal.tsx:53-59`; `ManualTradeModal.tsx:71-84`; `server.ts:43-45`, `199-201` | Credential id + masked key, без secret в клиенте |
| BL-003 | Risk/Money | `/api/binance/order` не вызывает `validateOrderRisk` | `server.ts:136-169`; risk отдельно `server.ts:229-266` | Risk validation внутри order endpoint до Binance |
| BL-004 | Auth | Регистрация/логин имитируются на клиенте | `AuthModal.tsx:49-62`, `65-76` | Users table + JWT auth |
| BL-005 | Architecture | Нет БД/ORM/миграций/audit trail | Нет Prisma/Drizzle/PostgreSQL/migrations | Начать с Этапа 1 ТЗ |

## P1 / High

| ID | Дефект/риск | Доказательство |
|---|---|---|
| HI-001 | AI auto-trading не идет через execution engine | `src/App.tsx:393-494` |
| HI-002 | Risk-check можно обойти при ошибке сети | `src/App.tsx:670-690` |
| HI-003 | Лимит позиций в AI hardcoded `positions.length < 5` | `src/App.tsx:443` |
| HI-004 | SL/TP не выставляются на Binance | `ManualTradeModal.tsx:50-56`, `96-109`; `server/binance.ts:251-324` |
| HI-005 | Kill Switch не закрывает реальные биржевые позиции | `server.ts:269-317` |
| HI-006 | Paper MARKET order исполняется по 50000 | `server/binance.ts:327-340` |
| HI-007 | Нет kline/depth WebSocket streams | `server/websocket.ts:59-60` |
| HI-008 | Нет exponential backoff | `server/websocket.ts:114-119` |
| HI-009 | Нет кеша 500 свечей | Redis/ring buffer отсутствуют |
| HI-010 | Google Search Grounding не входит в trading decision | Grounding есть в `/api/market-news`, но не в `/api/ai-analysis` |
| HI-011 | JSON Gemini не валидируется схемой | `server.ts` использует `JSON.parse` без schema validation |
| HI-012 | Backtest возвращает зашитые числа | `server.ts:325-381` |
| HI-013 | Нет Binance user data stream `listenKey` | Реализация не найдена |
| HI-014 | Telegram не вызывается на все события ТЗ | Транспорт есть, событийной шины нет |

## P2 / Medium

| ID | Дефект/риск | Доказательство |
|---|---|---|
| MD-001 | `tsconfig` без strict mode | `tsconfig.json` |
| MD-002 | Frontend bundle > 500 kB warning | `npm run build`: 805.76 kB minified / 226.08 kB gzip |
| MD-003 | README остался шаблоном AI Studio | `README.md` |
| MD-004 | `.git` отсутствует | `git status` не работает в папке проекта |
| MD-005 | UI claims про AES/read-only расходятся с кодом | `AuthModal.tsx:305-308`, Binance trading UI |

## Следующий triage

1. Закрыть BL-001..BL-005 как Этап 1.
2. После этого встроить risk в order execution.
3. Затем отдельно идти по Этапам 2-6 ТЗ.
