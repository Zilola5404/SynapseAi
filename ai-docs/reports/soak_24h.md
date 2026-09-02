# 24h Testnet soak

Не запускается автоматически в CI. После того как Testnet authenticated = true:

1. `npm run dev` (один процесс, один Telegram bot).
2. Каждые ~1–2 часа проверять `/api/health`:
   - `binanceAuthenticated`
   - `binanceWs`
   - `positionWorker` / `tradingWorker`
   - `telegramPolling`
   - `userStreams`
3. Если есть открытая TESTNET позиция: `updatedAt` и `currentPrice` должны меняться.
4. Смотреть RSS/heap процесса (диспетчер задач / `Get-Process node`).
5. Убедиться, что WS reconnect не роняет workers (`reconnectAttempt` в `details.ws`).
6. Telegram отвечает на `/status`.

Остановить: Ctrl+C. Kill switch: `/panic`.
