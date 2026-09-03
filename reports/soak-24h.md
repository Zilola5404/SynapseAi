# 24h soak

**Вердикт:** **FAIL** (24h criterion not yet met)

A live TESTNET process was not held for ≥ 24 hours in this release pass.

PASS only if **one process** holds `uptime >= 24h` with:

- Telegram polling alive
- No crash
- No stuck workers
- No duplicate orders
- No unsafe LIVE trading
- New trades blocked when market data is stale; open positions still monitored

After `RELEASE: MVP v1.0`, start `npm run dev` and leave that process running. Update this file from a real `/health` snapshot when uptime ≥ 24h.

**Do not** treat calendar time since the last commit as process uptime.
