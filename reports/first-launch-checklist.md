# First launch checklist (Telegram MVP)

This is **not** a claim of `SYNAPSEAI V1 READY`. Soak 24h has not passed (see `reports/soak-24h.md`).

## Infrastructure
- [ ] `npm run dev` starts
- [ ] PostgreSQL OK
- [ ] Telegram OK
- [ ] Binance market data OK
- [ ] WebSocket OK
- [ ] Workers OK
- [ ] Boot prints `[SYNAPSEAI READY]` with LIVE: DISABLED

## Telegram
- [ ] `/start` works (Russian welcome, TESTNET/PAPER, auto off, risk on)
- [ ] Reply keyboard: Рынок / Сигналы / Автоторговля / Сделки / Статистика / Риски / Настройки / Помощь
- [ ] Market analysis card (trend, regime, no-trade/LONG/SHORT)
- [ ] Signals: entry / SL / TP / RR / why / “прибыль не гарантируется”
- [ ] No-signal copy: «Сейчас сделки нет»
- [ ] Trade history with TEST / AUTO / MANUAL badges
- [ ] Statistics exclude `/testorder`
- [ ] Help works

## Trading
- [ ] TESTNET only (LIVE blocked unless `ALLOW_LIVE=true`)
- [ ] `/testorder` user error is specific (not generic)
- [ ] Position opens / SL / TP / close / PnL / fees

## Safety
- [ ] Kill switch
- [ ] Duplicate protection
- [ ] Stale data blocks trade
- [ ] Stale signal blocks trade
- [ ] Risk Engine + cost gate (`INSUFFICIENT_NET_EDGE` / `TP_TOO_CLOSE_TO_COVER_COSTS`)
- [ ] LIVE impossible by default

## After MVP
- [ ] 24h (better 72h) TESTNET soak → `reports/soak-24h.md` PASS
- [ ] 20–30+ closed **strategy** trades before calling it strategy performance
