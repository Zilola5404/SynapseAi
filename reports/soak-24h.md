# 24h soak

**Старт процесса:** 2026-09-02 22:54:26 UTC+3 (`npm run dev`)  
**Снимок:** 2026-09-02 23:09 UTC+3  
**Вердикт:** **IN PROGRESS / FAIL по длительности** — 24 часа ещё не прошли.

## Снимок

| Проверка | Значение |
|---|---|
| Uptime | ~15 минут на этом процессе (рестарт recovery 22:54) |
| Working set | ~84 MB |
| `/api/health` postgres | true |
| redis | true |
| binanceRest | true |
| binanceAuthenticated | true |
| binanceWs | true, reconnectAttempt 0, 8 symbols |
| telegramPolling | true |
| recoveryReady | true |
| userStreams | 1 |
| workers | scan + positions + reconcile |
| ALLOW_LIVE | false |
| Open TESTNET positions | 0 |

## Как довести до PASS

1. Не убивать единственный `npm run dev` 24 часа.  
2. Каждый 1–2 часа: `Invoke-RestMethod http://localhost:3000/api/health`  
3. Смотреть RSS процесса, Telegram `/status`, reconnectAttempt.  
4. После 24ч обновить этот файл: PASS только если процесс не падал, WS жив, polling жив, нет stuck CLOSING.

Пока длительность < 24ч — **STABILITY = FAIL** в production-readiness.
