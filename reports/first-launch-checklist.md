# First launch checklist (Telegram MVP)

This is **not** a claim that 24h soak has passed (see `reports/soak-24h.md`).

## Infrastructure
- [ ] `npm run dev` starts
- [ ] PostgreSQL OK
- [ ] Telegram OK
- [ ] Binance market data OK
- [ ] WebSocket OK
- [ ] Workers OK
- [ ] Boot prints `[SYNAPSEAI READY]` with LIVE: DISABLED

## Telegram
- [ ] `/start` — Russian welcome, AUTO off, four actions
- [ ] Reply keyboard: Рынок / Сигналы / Сделки / Статистика / TESTNET / Риски / Настройки / Помощь
- [ ] `/system` — health (Database, Telegram, Binance, Market Data, Workers, WebSocket, TESTNET, LIVE disabled)
- [ ] Market analysis card
- [ ] Signals: LONG/SHORT, TP1–TP3, RR, disclaimer, TESTNET / Details / Skip
- [ ] No-signal copy: «Сейчас качественного сигнала нет»
- [ ] Trade history: profit/loss, entry, exit, close reason
- [ ] TESTNET MODE screen
- [ ] Statistics exclude `/testorder`

## Trading
- [ ] TESTNET only (LIVE blocked unless `ALLOW_LIVE=true`)
- [ ] `/testorder` user error is specific (not generic)
- [ ] Position opens / SL / TP / close / PnL / fees

## Safety
- [ ] Kill switch
- [ ] Duplicate protection
- [ ] Stale data blocks **new** trades (positions still monitored)
- [ ] Stale signal blocks trade
- [ ] Risk Engine + cost gate
- [ ] AUTO off until EDGE_CONFIRMED
- [ ] LIVE impossible by default
