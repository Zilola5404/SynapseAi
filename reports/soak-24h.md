# 24h soak

**Вердикт:** **FAIL** — 24h soak is not completed on this pass.

Canonical walk-forward / OOS certification was run instead of claiming a new soak. The previous snapshot (2026-09-02) had **0.80 h** uptime. Calendar time since that pid is **not** process uptime.

PASS only if **one process** holds `uptime >= 24h` with:

- Telegram polling alive
- No crash
- No stuck workers
- No duplicate orders
- No unsafe LIVE trading

Start: `npm run dev` and leave it running 24h, then update this file from a real health snapshot.
