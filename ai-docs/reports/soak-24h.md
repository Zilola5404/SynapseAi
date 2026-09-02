# 24h soak

**Старт процесса:** 2026-09-02 22:54:26 UTC+3 (`npm run dev`, pid 28152)
**Снимок:** 2026-09-02T20:42:31.555Z
**Вердикт:** **FAIL** — фактический uptime **0.80 ч** (нужно ≥ 24).

| Проверка | Значение |
|---|---|
| Actual uptime | 0.80 h |
| Restart count (this pid) | 0 observed since 22:54 UTC+3 |
| Worker crashes | not observed in this snapshot |
| WebSocket | true |
| Telegram | true |
| Database | true |
| Memory trend | not sampled over 24h — insufficient duration |
| ALLOW_LIVE | false |

15 minutes is not a soak. Uptime 0.80h is not a 24h soak. FAIL until a single process holds ≥24h.
