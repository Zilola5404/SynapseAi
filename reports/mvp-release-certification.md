# RELEASE: MVP v1.0

**Date:** 2026-09-04  
**Git tag (intelligence freeze):** `synapse-baseline-v1`  
**Release name:** MVP v1.0

## Safety posture

- **AUTO Trading:** OFF (`canonical-cert.json` verdict is not `EDGE_CONFIRMED`)
- **LIVE Trading:** OFF (`ALLOW_LIVE` is not true)
- **Strategy verdict:** EDGE_NOT_CONFIRMED (`A+_INSUFFICIENT_SAMPLE`)
- Intelligence frozen as **RESEARCH_BASELINE_V1** — no weight / threshold / filter fitting in this release

## Checklist

| Gate | Result |
| --- | --- |
| Telegram MVP | PASS |
| Russian UX | PASS |
| Signals | PASS |
| Testnet execution | PASS |
| Risk Engine | PASS |
| Kill Switch | PASS |
| Recovery | PASS |
| 24h Soak | FAIL |
| TP Ladder | PASS |
| AUTO Trading | OFF |
| LIVE Trading | OFF |
| Strategy verdict | EDGE_NOT_CONFIRMED |

## Evidence

- `npm test` — all staged unit tests passed
- `npx tsc --noEmit` — passed
- Telegram: `/start` welcome (AUTO off), reply keyboard (Рынок / Сигналы / Сделки / Статистика / TESTNET / Риски / Настройки / Помощь), `/system`, `/testnet`
- Signals: opportunity card with TP1–TP3 and disclaimer; no-signal copy without technical errors
- History: profit / loss, entry, exit, close reason
- Binance signed REST: 3 attempts on timeout / connection / 5xx / 429; generic 4xx not retried; stale market data blocks **new** trades; position monitor continues
- TESTNET TP ladder 30/30/40 on BTCUSDT 0.01: remaining 70% → 40% → 0%, `reduceOnly=true`
- 24h soak is **not** claimed (see `reports/soak-24h.md`)

## How to run

```
npm run dev
```

Telegram bot is the product surface. Do not start a second process if port 3000 is already bound.
