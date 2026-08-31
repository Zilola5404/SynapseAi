# API Current State — SynapseAi

**Дата:** 25.08.2026  
**Источник:** `server.ts`

## Health

| Method | Path | Статус |
|---|---|---|
| GET | `/api/health` | OK as demo |
| GET | `/api/system/health` | Partial monitoring |

## Binance

| Method | Path | Назначение | Статус/риск |
|---|---|---|---|
| GET | `/api/binance/ping` | Ping/auth test | Unsafe: `apiKey/apiSecret` могут быть query params |
| GET | `/api/binance/klines` | REST candles + indicators | Partial: не WS, нет кеша |
| GET | `/api/binance/orderbook` | REST depth + imbalance | Partial: не WS depth stream |
| POST | `/api/binance/verify-keys` | Проверка ключей | Unsafe: secret из browser body |
| GET | `/api/binance/stream` | SSE over public ticker WS | Partial: только ticker |
| POST | `/api/binance/order` | Market/Limit order | Unsafe: нет server risk guard, secret в body |
| POST | `/api/binance/cancel-order` | Cancel order | Partial: нет auth, secret в body |
| GET | `/api/binance/open-orders` | Fetch open orders | Unsafe: secret может быть query param |
| POST | `/api/binance/risk-check` | Standalone risk validation | Partial: optional, можно обойти |
| POST | `/api/binance/kill-switch` | Cancel open orders | Partial/wrong: не закрывает позиции market order |

## AI / Market / Backtest

| Method | Path | Назначение | Статус/риск |
|---|---|---|---|
| GET | `/api/market-data` | Binance ticker fallback to simulated assets | Partial: fallback может перезаписать live state |
| POST | `/api/ai-analysis` | Gemini/fallback trading decision | Partial: нет schema validation и execution chain |
| GET | `/api/market-news` | Gemini + Google Search Grounding news | Partial: не связан напрямую с trading decision |
| POST | `/api/generate-strategy` | Strategy config generator | Partial: нет schema validation/persistence |
| POST | `/api/backtest/run` | Scenario backtest numbers | Wrong for production: зашитые числа |

## Telegram

| Method | Path | Статус/риск |
|---|---|
| POST | `/api/telegram/test` | Partial: token из browser body |
| POST | `/api/telegram/send` | Partial: нет auth/rate limit/audit |

## Missing API по ТЗ

- Auth: register, login, logout, current user.
- Credentials: save encrypted, list masked, delete.
- Risk settings: get/update per user.
- Positions: list, close, sync from exchange.
- Orders: history, open orders from DB + exchange sync.
- System logs: query audit events.
- Market data: candles/orderbook from server cache.

## Required API rules

1. Все trading/account endpoints требуют JWT.
2. Клиент не передает Binance secret после сохранения credentials.
3. Order endpoint сам достает credentials текущего пользователя из encrypted vault.
4. Risk validation выполняется внутри order transaction до Binance call.
5. Любое отклонение пишется в `system_logs`.
