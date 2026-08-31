# Dashboard — SynapseAi

**Обновлено:** 25.08.2026  
**Обновил:** Codex / Senior Architect  
**Статус:** после аудита ТЗ, до исправлений

## Готовность

| Метрика | Значение |
|---|---:|
| Готовность проекта относительно production-ТЗ | 15-20% |
| Готовность как demo/MVP | 60-70% |
| Этап 1: БД + безопасность | 0-10% |
| Этап 2: live market data | 25-35% |
| Этап 3: hard risk engine | 25-35% |
| Этап 4: execution engine | 20-30% |
| Этап 5: AI signal loop | 30-40% |
| Этап 6: monitoring/deploy | 10-15% |
| Готовность к Production | 0% |

## Задачи

- **Завершено:** `AUDIT-2026-08-25` — аудит соответствия ТЗ и адаптация `ai-docs`.
- **Следующая задача:** `STAGE1-001` — PostgreSQL + ORM + миграции.
- **После этого:** `STAGE1-002` — JWT-auth и server-side users.
- **После этого:** `STAGE1-003` — AES-256-GCM credentials vault и удаление Binance secret из браузера.

## Баги

| Категория | Количество |
|---|---:|
| Открытые дефекты/риски всего | 24 |
| P0 / Blocker | 5 |
| P1 / High | 14 |
| P2 / Medium/Low | 5 |

Подробно: `ai-docs/reports/audit_tz_compliance_2026-08-25.md`.

## Риски и долг

- **Безопасность:** красный статус. Binance secret хранится в `localStorage` и передается из клиента.
- **Архитектура:** красный статус. Нет БД/JWT/encryption, state торговли находится на клиенте.
- **Risk Engine:** красный статус. `/api/binance/order` не принуждает `validateOrderRisk`.
- **Execution:** желтый/красный статус. Есть signed REST helper, но нет SL/TP на Binance и `listenKey`.
- **Тестирование:** красный статус. Автотесты отсутствуют.
- **Traceability:** красный статус. `.git` в `C:\01_Projects\SynapseAi` не обнаружен.

## Тестирование и релиз

| Показатель | Статус |
|---|---|
| TypeScript check | Зеленый: `npm run lint` прошел без ошибок |
| Production build | Желтый: `npm run build` прошел, bundle warning 805.76 kB minified / 226.08 kB gzip |
| Unit tests | Красный: отсутствуют |
| Integration tests | Красный: отсутствуют |
| E2E tests | Красный: отсутствуют |
| Security tests | Красный: отсутствуют |
| CI/CD | Красный: не обнаружено |
| Docker/Compose | Красный: отсутствует |
| Последний audit | 25.08.2026, `ai-docs/reports/audit_tz_compliance_2026-08-25.md` |
| Последний commit | Неизвестно: `.git` отсутствует |

## Production Gate

До Production запрещено считать систему торговым роботом. Допустимый статус: demo/MVP dashboard.

Минимальные блокеры для снятия gate:

1. Закрыть Этап 1 ТЗ: PostgreSQL/ORM/JWT/AES-256-GCM/migrations.
2. Убрать Binance secret из browser storage и client payloads.
3. Встроить server-side risk validation внутрь order execution.
4. Добавить тесты приемки для каждого этапа ТЗ.
5. Добавить CI/CD и Docker Compose.
