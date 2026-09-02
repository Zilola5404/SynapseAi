# SYNAPSEAI STRATEGY VALIDATION

**Period:** 2026-08 → 2026-09-02 (доступная история репозитория + PostgreSQL)  
**Вердикт:** выборки **недостаточно**, чтобы утверждать, что A+ статистически лучше A.

Цифры ниже — честный срез. Это **не** доказательство edge.

## Как считаем

Источник: `server/trading/strategy/setupStats.ts`

- Win Rate = wins / trades  
- Profit Factor = gross wins / |gross losses|  
- Expectancy = mean net PnL  
- Max Drawdown = min running equity (по последовательности сделок grade)  
- Average R — только если у сделки есть `rMultiple`  
- Fees суммируются отдельно  

Auto-режим открывает **только A+**. A и B в live auto не копятся сами — это снижает сравнимость.

## A+ SETUPS

Trades: недостаточно закрытых сделок с тегом A+ в `order_history` (история Testnet certification — ручной `TEST_ORDER`, не рыночный A+ сетап).

Win Rate: n/a  
Profit Factor: n/a  
Expectancy: n/a  
Max Drawdown: n/a  

Live Testnet certification fills 2026-09-02 (ручной TEST ORDER, grade в сигнале A+ формально): 2 закрытия, оба небольшие убытки из-за спреда/комиссии на min лоте (~ −0.42 и ~ −0.18 USDT). Это **не** статистика стратегии.

## A SETUPS

Trades: 0 tagged closed trades в этом срезе.

## B SETUPS

Trades: 0 tagged closed trades в этом срезе.

## PAPER

Есть PAPER soak-гейт (`paperSoak.ts`): цель 10–20 закрытий со SL **и** TP, без stuck CLOSING и дублей. Готовность к Testnet soak по этому гейту — отдельный флаг `readyForTestnet`, не путать с «A+ > A».

## Backtest / lookahead

- Walk-forward + three-way split: `server/trading/backtest/mtf.ts` unit PASS  
- No lookahead: `server/trading/certification/noLookahead.test.ts` PASS  
- Полный out-of-sample backtest с метриками A+ vs A **не прогонялся** на длинной истории (нет достаточного tagged dataset)

## Acceptance P3

| Критерий | Статус |
|---|---|
| No lookahead bias (unit) | PASS |
| Backtest helpers | PASS |
| Out-of-sample completed | **FAIL** — нет полного OOS прогона |
| A+ statistics available | **FAIL** — sample too small |
| A statistics available | **FAIL** — sample too small |
| Expectancy calculated | код есть; live sample too small |

Повторить, когда накопится ≥30 закрытых сделок каждого класса A+ и A (PAPER soak, затем Testnet soak).
