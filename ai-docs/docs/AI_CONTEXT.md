# AI Context — SynapseAi

> Читать первым перед любой работой по проекту.
> Последнее обновление: 25.08.2026.

## 1. Назначение проекта

SynapseAi — AI Trading System для криптовалют. Сейчас это demo/MVP dashboard с Binance/Gemini/Telegram заготовками. Целевое состояние по `Техническое Задание.docx` — production-робот для Binance Futures Testnet с серверным risk engine, execution engine, PostgreSQL, JWT, AES-256-GCM, мониторингом и deploy-контуром.

## 2. Фактическая архитектура

Тип: монолитный Node/Express + Vite SPA в одном процессе.

| Компонент | Файл/папка | Назначение | Статус |
|---|---|---|---|
| Frontend SPA | `src/App.tsx`, `src/components/*` | Dashboard, лендинг, модалки, локальный trading state | Demo/MVP |
| Backend API | `server.ts` | Express routes, Vite middleware, Gemini/Binance/Telegram endpoints | Монолит |
| Binance REST | `server/binance.ts` | HMAC REST helper, klines, depth, orders | Частично |
| Binance WS | `server/websocket.ts` | Public ticker WS -> SSE | Частично, только ticker |
| Risk engine | `server/risk.ts` | Risk validation helpers | Частично, не встроено в order path |
| Telegram | `server/telegram.ts` | send/test Bot API | Транспорт есть, событийной шины нет |
| Mock data | `src/data/initialData.ts` | Начальные assets/positions/trades/logs | Demo-заглушки |

## 3. Стек

| Слой | Технология | Комментарий |
|---|---|---|
| Frontend | React 19 + Vite | SPA |
| Styling/UI | Tailwind CSS, Recharts, lucide-react, motion | Dashboard UI |
| Backend | Node.js + Express | `server.ts` |
| AI | `@google/genai` | Gemini endpoint + fallback |
| Exchange | Custom Binance REST + `ws` | Официальный futures connector не используется |
| БД | отсутствует | PostgreSQL/ORM по ТЗ не реализованы |
| Auth | отсутствует | Клиентская имитация через `localStorage` |
| CI/CD | отсутствует | Pipeline не найден |
| Deploy | отсутствует | Docker/Compose не найден |

## 4. Главные факты для ИИ-агентов

1. Это не production-система. Не выдавать demo-поведение за готовый trading robot.
2. Этап 1 ТЗ не закрыт: нет PostgreSQL, JWT, AES-256-GCM и миграций.
3. Binance API Key/Secret сейчас сохраняются в browser `localStorage`; это P0 security defect.
4. `/api/binance/order` не вызывает `validateOrderRisk`; server-side risk можно обойти.
5. AI auto-trading добавляет позицию в React state, не проходит через execution engine и Binance.
6. SL/TP/trailing stop не являются биржевыми ордерами.
7. Нет `listenKey` user data stream, поэтому состояние биржи не синхронизируется.
8. Нет автотестов, CI/CD, Docker, production logs.
9. `.git` не обнаружен в `C:\01_Projects\SynapseAi`.

## 5. Обязательный порядок чтения

1. `ai-docs/docs/AI_CONTEXT.md`
2. `ai-docs/docs/CURRENT_STATUS.md`
3. `ai-docs/ai/DASHBOARD.md`
4. `ai-docs/reports/audit_tz_compliance_2026-08-25.md`
5. `reports/CodeReview/BL-001-analysis.md` — предыдущий подробный аудит, продублирован в `ai-docs/reports`
6. `Техническое Задание.docx`

## 6. Следующее правильное действие

Начинать только Этап 1 ТЗ:

1. PostgreSQL + ORM + migrations.
2. JWT auth.
3. AES-256-GCM credentials vault.
4. Удаление Binance secret из клиента.
5. Тесты security/persistence/auth.

Не начинать Этапы 2-6, пока Этап 1 не закрыт.
