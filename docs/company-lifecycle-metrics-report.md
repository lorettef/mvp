# Отчёт — жизненный цикл компании, онбординг, исторические данные, удаление, когорты, хранение данных

Дата: 2026-09-04. Ветка: `dev`. Область: 6 связанных задач + архитектурный аудит хранения данных.

---

## Резюме

Реализовано 6 изменений поверх Startup Engine (FastAPI + PostgreSQL/SQLite, React + TypeScript):

1. **Онбординг-мастер** — создание компании через «сфера → бизнес-модель → рекомендуемые метрики» (data-driven каталог).
2. **Исторический факт** — подтверждено, что ограничения «только прошлый месяц» в коде не было; ввод задним числом работает (регресс-тест).
3. **Удаление данных** — DELETE для метрик/когорт/бюджета с confirmation-диалогом.
4. **Частичные когорты** — матрица сохраняется частично, `null ≠ 0`.
5. **Жизненный цикл компании** — архив (`archived_at`) + восстановление + полное удаление с каскадом.
6. **Аудит хранения данных** — фикс `.dockerignore`, документирование self-host и AI-egress.

Все коммиты атомарные, TDD. Полный гейт зелёный (см. раздел Testing).

---

## UX — что изменилось

- **Онбординг-мастер (4 шага)** вместо плоской формы: название + «Место нахождение» → сфера деятельности (из каталога) → бизнес-модель → обзор рекомендуемых метрик с обоснованием «почему» + валовая маржа. Выбор индустрии фильтрует доступные бизнес-модели; каждая рекомендуемая метрика снабжена `label` и `why`.
- **Удаление** — кнопки удаления (иконка корзины) у строк метрик/когорт/бюджета открывают переиспользуемый `ConfirmDialog` («Удалить данные?»), подтверждение реально вызывает DELETE.
- **Частичные когорты** — можно заполнять только доступные ячейки матрицы; пустые ячейки рендерятся как `—` без цвета heatmap и не превращаются в 0.
- **Архив/восстановление/удаление компании** — список разделён на «активные» и «архив»; действия «Архивировать»/«Восстановить»/«Удалить» с подтверждением («Удалить компанию и все связанные данные?»).
- Компоненты: `CompanyOnboardingWizard.tsx`, `CompanyLifecycleSections.tsx`, `confirm-dialog.tsx` (новые); `CohortsTab`, `BudgetTab`, `CompanyDetail`, `CompaniesDashboard` (доработаны).

---

## Data — где и как хранятся данные

**Где сейчас реально хранятся данные:**
- **Production / Docker**: PostgreSQL 15 (контейнер `postgres:15-alpine`) в **Docker named-volume `postgres_data`** (на хосте `/var/lib/docker/volumes/<project>_postgres_data/_data`). Всё приложение (Nginx+React, FastAPI, Postgres) — на одном сервере, БД доступна только по внутренней Docker-сети.
- **Локальная разработка без Docker / тесты**: SQLite-файл (`backend/startup_engine.db`, `test.db`).

**Что после `docker compose down` / `up`:**
- Named-volume **сохраняется** (обычный `down` не удаляет volume). После `up` данные на месте. Развёртывание использует `up -d --remove-orphans` — удаляет только осиротевшие контейнеры, не volume.

**Что после удаления контейнера:**
- `docker rm` **не удаляет** named-volume. Данные теряются только при `docker compose down -v`, `docker volume rm` или потере диска хоста.

**Persistent volume:** да — `postgres_data` (docker-compose.yml:12, docker-compose.prod.yml:10).

**Бэкапы:** **отсутствуют** (grep по репозиторию не нашёл ни `pg_dump`, ни backup-скриптов). Единственная копия данных — volume на одном сервере. **Предложение (не реализовано в этом плане):** sidecar/cron `pg_dump` (например `docker run --rm -v mvp_postgres_data:... postgres pg_dump ...`) в customer-owned хранилище, либо `pg_dump` по расписанию на хосте.

---

## Backend — какие API/validation изменены

Новые эндпоинты:
- `GET /api/v1/catalog` — метрический каталог (индустрии, бизнес-модели, профили рекомендуемых метрик).
- `POST /api/v1/companies/{id}/archive`, `POST /api/v1/companies/{id}/restore` — admin-only.
- `GET /api/v1/companies?archived=true` — список архивных компаний.
- `DELETE /api/v1/companies/{id}/metrics/{metric_id}`, `.../cohorts/{cohort_id}`, `.../budgets/{budget_id}` — admin/company.
- `DELETE /api/v1/companies/{id}` — теперь с **явным каскадным удалением** зависимых строк (не полагается на DB-level cascade).

Изменения валидации/схем:
- `CompanyCreate/Update/Response` += `business_model`, `archived_at`.
- `CohortUpsert/Response.retention_m1..m12` → `Optional[float]` (null = «нет данных», 0 = «0%»).
- `DELETE`-обработчики возвращают 404 при чужой/отсутствующей записи, 403 для observer.

Сервисы: `company_service` (archive/restore/list-filter), `metric_service`/`cohort_service`/`budget_service` (delete), `cohort_service` (null-safe upsert), `unit_economics_service` (пропуск отсутствующих retention).

---

## Database — модели/таблицы/migrations

Одна новая миграция **`011_company_lifecycle`** (down_revision=`010_org_type_and_invites`):
- `companies` += `business_model VARCHAR(50) NULL`, `archived_at DATETIME NULL`.
- `cohorts.retention_m1..m12` → `nullable` (снят `server_default="0"` на 8 колонках).

Граф зависимостей компании (все `ondelete=CASCADE`): `Metric`, `Cohort`, `Budget`, `Task`, `HiringPlan`, `HiringSettings`, `Financing`, `Valuation`; `User.company_id` — `SET NULL`; `AnalyticsEvent` не имеет FK на компанию. Каскад выполняется явно (SQLite без `PRAGMA foreign_keys=ON` не каскадирует на уровне БД).

Сериализация: `ConfigDict(from_attributes=True)` — без ручных мапперов.

---

## AI — какие функции реально работают, что уходит наружу

Рабочие AI-функции (через `AIService`, провайдер `AI_PROVIDER`):
- **Рекомендации** (`POST /recommendations/get`) — отправляет агрегированные метрики `mrr/cac/ltv/churn/arpu/runway/stage` (это автономный `/metrics/analyze`-контракт, а НЕ сырые данные компании).
- **Генерация плана** (`POST /companies/{id}/generate-plan`) — отправляет историю фактов `revenue/new_units/arpu/marketing_spend/retention_rate` (по периодам).
- **AI-инсайты** (12 сценариев) — текст по сценарию аналитического модуля.
- **Прогноз (Prophet)** — локальный, без внешних вызовов.

Провайдеры и направление данных:
- **DeepSeek** (`_chat_deepseek`, OpenAI-совместимый, `DEEPSEEK_BASE_URL`) или **GigaChat** (Сбер, `GIGACHAT_API_URL`). Оба — внешние API; выбранный провайдер получает **только агрегированные метрики/историю** в промпте, НЕ все данные БД.
- При `AI_PROVIDER=demo` или ошибке провайдера — **детерминированный demo-фолбэк** без внешних вызовов.
- Провайдер сменяем (`AI_PROVIDER`), слой отделён от бизнес-логики (`AIService.complete` — единая точка). Self-hosted AI в будущем = новая реализация `_chat_*`/конфиг, без изменения бизнес-логики.

**Разделение Core Data / AI Layer** соблюдено: AI не хранит бизнес-данные (кэш ответов — в своей таблице `ai_cache` с scope по `user_id`), основная модель данных — в Postgres/SQLite.

---

## Security — какие данные покидают инфраструктуру

- **Внешние вызовы приложения** (для self-hosted инстанса): только DeepSeek/GigaChat (агрегированные метрики в промптах) и Let's Encrypt (TLS). Внешних БД нет.
- **Исправлен дефект утечки секретов в образ:** добавлен `backend/.dockerignore` (`.env`, `.env.*`, `*.db`, `*.sqlite*`, тесты). Ранее локальный `docker compose build` / README `up -d --build` запекал в образ живой `DEEPSEEK_API_KEY` и dev SQLite-файлы (контекст сборки `./backend`, а корневой `.dockerignore` не применялся к нему). CI-сборки из git-чекаута чисты (`.env`/`.db` в git не попадали).
- **Рекомендация:** ротировать ключ DeepSeek из `backend/.env` (он был в локальном образе при ручных сборках).
- Prod-секреты — в GitHub Secrets, пишутся в `/app/mvp/.env` на сервере при деплое.

---

## Testing — команды и результаты

| Проверка | Результат |
|---|---|
| Backend `python -m pytest -q` | ✅ **212 passed** (1 DeprecationWarning) |
| Alembic `upgrade head` + `downgrade base` (fresh SQLite) | ✅ roundtrip OK (до `011_company_lifecycle`) |
| Frontend `npx tsc --noEmit` | ✅ exit 0 |
| Frontend `npx vitest run` | ✅ **177 passed** (31 файл) |
| Frontend `npm run build` | ✅ exit 0 |
| Frontend `npm run lint` | ✅ 0 errors (6 warnings: 3× `any` в `client.ts`, 3× react-refresh) |

---

## Ответы на вопросы раздела 6

1. **Где сейчас реально хранятся данные?** — PostgreSQL в Docker named-volume `postgres_data` на одном сервере (dev/тесты — SQLite-файл).
2. **После `docker compose down/up`?** — данные сохраняются (volume не удаляется).
3. **После удаления контейнера?** — сохраняются (volume отделён от контейнера).
4. **Persistent volume есть?** — да, `postgres_data`.
5. **Что уходит сторонним API?** — только агрегированные метрики/история фактов в промптах DeepSeek/GigaChat (отключаемо через `AI_PROVIDER=demo`).
6. **Можно ли развернуть на сервере фонда/стартапа с БД полностью на их сервере?** — **Да.** Весь стек (Nginx+React, FastAPI, Postgres) — docker-compose на одном хосте; БД — локальный контейнер, внешних БД нет; `DATABASE_URL` — единственная точка подключения (можно подставить customer-provided Postgres). Единственные внешние зависимости: образы из ghcr.io (заменяемы локальной сборкой из исходников), Let's Encrypt, AI-провайдеры (опционально `demo`).

## Оставшиеся риски / follow-up

- **Бэкапы**: предложен механизм (pg_dump sidecar/cron), но не реализован — нужен sign-off.
- **TTL токена / refresh**: `/auth/refresh` + `jti` есть; сокращение TTL — follow-up.
- **Локальная сборка образа**: `.dockerignore` добавлен; ротация ключа DeepSeek — ручное действие.
- **Ручной browser-QA (F3)**: не выполнен — Chrome не установлен в окружении.
