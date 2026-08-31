# Document Registry — Полный реестр документов проекта

> Обновляет: Technical Writer.
> Когда обновляется: при добавлении/удалении типа документа.
> Используют: все роли — как справочник «какой документ за что отвечает».
> Обязателен: да.

Для каждого документа: назначение · кто отвечает за обновление · когда
обновляется · какие ИИ используют · обязательность · пример структуры (ссылка).

| Документ | Назначение | Ответственный | Когда обновляется | Кто использует | Обязателен |
|---|---|---|---|---|---|
| `docs/AI_CONTEXT.md` | Единый контекст проекта | Chief Architect / PM | При смене стека/архитектуры | Все роли | Да |
| `docs/CURRENT_STATUS.md` | Снимок текущего состояния | Project Manager | После каждой задачи | Все роли | Да |
| `docs/PROJECT_RULES.md` | Конституция проекта | Owner | Крайне редко | Все роли | Да |
| `docs/DEFINITION_OF_DONE.md` | Критерии завершения | PM + Architect | После ретроспектив | Все роли | Да |
| `docs/DOCUMENTATION_LIFECYCLE.md` | Правила жизни документов | Technical Writer | При изменении процесса | Documentation, PM | Да |
| `docs/GIT_WORKFLOW.md` | Правила Git и коммитов | Architect / Developer | При смене CI/CD | Developer, Reviewer, Release Manager | Да |
| `ai/DASHBOARD.md` | Метрики готовности проекта | Control Center / PM | После каждой задачи | Все роли | Да |
| `ai/AI_WORKFLOW.md` | Цикл работы ролей | Control Center | При изменении процесса | Все роли | Да |
| `ai/HANDOFF_PROTOCOL.md` | Стандарт передачи задач | Control Center | После ретроспектив | Все роли | Да |
| `ai/DOCUMENT_REGISTRY.md` | Этот реестр | Technical Writer | При добавлении документа | Все роли | Да |
| `prompts/*.md` | Системные промпты ролей | Owner / Control Center | Очень редко | Соответствующий ИИ-исполнитель роли | Да |
| `templates/task.md` | Форма постановки задачи | PM | При создании задачи | PM, Developer | Да |
| `templates/bug.md` | Форма регистрации бага | QA / любой исполнитель | При обнаружении бага | QA, Developer | Да |
| `templates/feature.md` | Форма описания фичи | Product Owner / PM | При новом запросе | PM, Architect | Да |
| `templates/decision.md` | Архитектурное/продуктовое решение (ADR) | Architect / Owner | При каждом значимом решении | Architect, Developer, будущие ИИ | Да |
| `templates/architecture.md` | Описание архитектурного модуля | Chief Architect | При изменении модуля | Architect, Developer | Да |
| `templates/api.md` | Спецификация API-эндпоинта | Architect / Developer | При изменении контракта | Developer, QA | Да |
| `templates/database.md` | Схема таблицы/сущности БД | Architect / Developer | При изменении схемы | Developer, QA | Да |
| `templates/release.md` | Паспорт релиза | Release Manager | Перед каждым релизом | Release Manager, Owner | Да |
| `templates/sprint.md` | План спринта | PM | В начале спринта | PM, все роли | Да |
| `templates/meeting.md` | Протокол встречи/синхронизации ИИ | PM / Control Center | После значимой синхронизации | Все роли | Нет |
| `templates/audit.md` | Отчёт независимого аудита | Independent Auditor | После каждого аудита | Auditor, PM, Owner | Да |
| `templates/code_review.md` | Отчёт code review | Reviewer | После каждого review | Reviewer, Developer | Да |
| `templates/qa_report.md` | Отчёт тестирования | QA Lead | После каждого тестового цикла | QA, PM | Да |
| `templates/security_report.md` | Отчёт по безопасности | Auditor / Developer | Перед MVP и Production | Auditor, Release Manager | Да (перед релизом) |
| `templates/performance_report.md` | Отчёт по производительности | Developer / QA | Перед Production | QA, Release Manager | Да (перед Production) |
| `templates/risk.md` | Реестр риска | Architect / Auditor | При выявлении риска | PM, Owner | Да |
| `templates/technical_debt.md` | Запись технического долга | Developer / Architect | При выявлении долга | PM, Architect | Да |
| `checklists/*.md` | Контрольные точки процесса | PM / QA | Редко | Все роли | Да |
| `reports/*.md` | Заполненные отчёты (история) | Соответствующая роль | По факту события | Все роли, будущие ИИ | Да |
| `specifications/*.md` | Технические контракты | Architect / Developer | При изменении контракта | Developer, QA | Да |
| `tests/*.md` | Test-планы и сценарии | QA Lead | При изменении функционала | QA, Developer | Да |
| `releases/CHANGELOG.md` | История версий | Release Manager | При каждом релизе | Все роли | Да |
| `scripts/*` | Автоматизация | Developer / Control Center | По необходимости | Control Center | Нет |

Полные примеры структуры каждого документа — см. соответствующий файл в
`/templates`, `/checklists` и `/prompts` (они и есть эталонная структура).
