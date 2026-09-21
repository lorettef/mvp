# Startup Investment Bridge — техническая карта проекта

> Living architecture map для разработчиков и coding agents. Актуализировано по коду и конфигурации репозитория 2026-09-22. При расхождении этого документа с кодом источником истины является код.

## Product

**Startup Investment Bridge** — B2B multi-tenant платформа для двух связанных контуров:

- фонды и акселераторы ведут портфель стартапов, сравнивают Plan и Fact, видят состояние компаний и готовят отчётность;
- самостоятельные стартапы или компании, приглашённые фондом, ведут метрики, бюджет, найм, финансирование и задачи подготовки к инвестиционному процессу.

Организация имеет тип `fund` или `startup`. Внутри неё находятся пользователи и компании. Роли пользователя: `admin`, `company`, `observer`. `admin` управляет компаниями своей организации; `company` работает только с назначенной компанией; `observer` имеет company-scoped read-only доступ там, где write-маршруты дополнительно ограничены ролями.

Проект не является только дашбордом: backend содержит расчётные сервисы P&L, Cash Flow, Cash Gap / Funding Need, unit economics, hiring, valuation и sensitivity, а также AI-assisted сценарии, отчёты и задачи.

## System Architecture

```text
Browser
  ↓
React SPA (pages → components → API / React Query / Zustand)
  ↓ HTTPS / REST, JSON, httpOnly auth cookie
Nginx (production static files, TLS, reverse proxy /api)
  ↓
FastAPI routes → services → SQLAlchemy models / database
  ├─ PostgreSQL
  ├─ DeepSeek or GigaChat HTTP API (when configured)
  └─ SMTP (optional weekly email reports)
```

Основные каталоги:

| Путь | Ответственность |
|---|---|
| `backend/app/api/v1/` | HTTP-маршруты, dependencies, role/access checks, Pydantic response contracts |
| `backend/app/services/` | Доменные операции, детерминированные расчёты, AI orchestration, reports |
| `backend/app/models/` | SQLAlchemy persistence model |
| `backend/app/schemas/` | Pydantic request/response model — backend-источник API-контрактов |
| `backend/app/core/` | Конфигурация, БД, auth/security, tenant context, тарифы, каталоги и health rules |
| `backend/alembic/` | Последовательная схема БД; текущий head — `016_hiring_roles` |
| `backend/tests/` | pytest API/service/security/migration regression suite |
| `frontend/src/pages/` | Route-level screens и композиция пользовательских сценариев |
| `frontend/src/components/` | Company/dashboard/common и локальные shadcn-style UI components |
| `frontend/src/api/` | Единый Axios client и domain API adapters |
| `frontend/src/lib/` | Navigation, React Query keys/client, formatting и UI utilities |
| `frontend/src/store/` | Zustand client state; сейчас persisted auth user |
| `frontend/src/i18n/` | Русская и английская локализация |
| `.github/workflows/` | Test и Build & Deploy workflows |
| `nginx/`, `scripts/`, `docker-compose*.yml` | Production proxy/TLS, operations и container orchestration |

### Backend layers

`API/Routes → Services → Models/Database` — основной поток. Routes проверяют входные данные, аутентификацию, роль и доступ к компании; business logic должна оставаться в services. Services используют `flush()`, а единая dependency `get_db()` владеет commit/rollback транзакции.

`app.main` регистрирует API под `/api/v1`, health endpoint — `/health`. OpenAPI генерируется FastAPI из route signatures и Pydantic schemas.

### Frontend flow

`Page → Components → domain API adapter → Axios → backend`. React Query хранит server state и управляет refetch/invalidation; Zustand не дублирует server state и хранит auth user. Axios использует `/api/v1`, `withCredentials: true` и рекурсивно преобразует response keys из `snake_case` в `camelCase` (кроме явно отключённых случаев).

## Tech Stack

Версии приведены только там, где они закреплены manifests, Dockerfiles или CI.

| Область | Фактический стек |
|---|---|
| Runtime | Python 3.12; Node.js 20 в frontend Docker/CI |
| Backend | FastAPI 0.115.6, Uvicorn 0.34.0, Pydantic 2.10.4, pydantic-settings 2.7.0 |
| Persistence | SQLAlchemy 2.0.36 async, asyncpg 0.30.0, Alembic 1.14.1 |
| Database | PostgreSQL 15 в Compose/CI; SQLite через aiosqlite 0.22.1 поддерживается тестами и кодом engine |
| Security | PyJWT 2.10.1, bcrypt 4.2.1, httpOnly cookie/Bearer JWT, SlowAPI 0.1.9 |
| Backend data/reporting | NumPy `>=2.0`, pandas `>=2.0`, ReportLab 5.0.1, openpyxl 3.1.5, HTTPX 0.28.1 |
| Frontend | React `^18.3.1`, React DOM `^18.3.1`, TypeScript `^5.7.2`, Vite `^5.4.11` |
| Frontend state/data | TanStack React Query `^5.62.8`, Zustand `^5.0.1`, Axios `^1.7.9` |
| UI | Tailwind CSS `^3.4.15`, Radix primitives, shadcn/ui-style local components, Recharts `^2.13.3`, Lucide React `^0.468.0`, Sonner `^2.0.8` |
| Routing/i18n | React Router `^6.28.0`, i18next `^26.4.0`, react-i18next `^17.0.12` |
| Tests/tooling | pytest 8.3.4, pytest-asyncio 0.25.2, pytest-cov 6.0.0, Vitest (manifest `^2.1.6`, installed run 2.1.9), Testing Library, ESLint `^9.15.0` |
| Infrastructure | Docker Compose, Nginx, Certbot, GitHub Actions, GitHub Container Registry |

`prophet` не является установленной зависимостью: метод `prophet` пытается импортировать его опционально и при отсутствии или ошибке использует polynomial fallback.

## Domain Model

### Tenancy, identity and portfolio

- `Organization`: tenant boundary, имя и тип `fund | startup`.
- `User`: глобально уникальные email/phone, роль, ссылки на organization и опционально company. `company_name` сохранён как deprecated compatibility field.
- `Invite`: token-based присоединение стартапа к организации фонда.
- `Company`: принадлежит организации; содержит профиль, industry, geography, business model, selected metrics, gross margin и archive state.
- `Subscription`: тариф и сохранённый счётчик AI usage. Тарифы `starter`, `pro`, `business`, `enterprise` заданы в `backend/app/core/plans.py`; в pilot-конфигурации enforcement централизованно отключён через `AI_QUOTA_ENABLED=false`, но billing-модель и поля usage сохранены.

### Operating data

- `Metric`: запись за месяц и тип `plan | fact`; raw inputs (`new_units`, `arpu`, `revenue`, `marketing_spend`, `retention_rate`) и derived `churn`, `ltv`, `cac`, `active_units`.
- `Budget`: помесячные Plan/Fact `marketing`, `development`, `fot`, `gna`.
- `Cohort`: помесячная Plan/Fact cohort matrix M1–M12, size и marketing spend.
- `Task`: company-scoped задача этапа `metrics | documents | negotiations | presentation`; manual или AI recommendation; readiness — процент завершённых задач.
- `AnalyticsEvent` и `AuditLog`: продуктовые события и аудит отдельных действий.

### Financial and planning data

- `HiringTeam`: текущий headcount и salary по роли.
- `HiringPlanRow`: required/recommended/approved hires по роли и месяцу.
- `HiringSettings`: ставки НДФЛ, страховых взносов и травматизма; в employer cost входят insurance + injury, но не НДФЛ.
- `HiringPlan`: legacy aggregate table; активный role-based hiring flow использует `HiringTeam` и `HiringPlanRow`.
- `Financing`: `investment` или `loan`, сумма/валюта/дата выдачи/контрагент; у loan также annual rate, term, repayment type и first payment date.
- `Valuation`: legacy persistence model существует, но текущий valuation endpoint рассчитывает ответ на лету и не сохраняет строки этой таблицы.

P&L, Cash Flow, Cash Gap / Funding Need, Unit Economics, Health и Sensitivity — вычисляемые представления сервисов, а не отдельные таблицы. PDF/XLSX reports также генерируются на запрос; отдельной сущности Report нет.

### AI data

- `AICache`: user-scoped 24-hour cache рекомендаций по hash метрик и company context.
- AI-generated recommendations могут конвертироваться в `Task` с `source=ai_recommendation` и дедупликацией по metric/title.
- AI-generated Plan сохраняется как обычные `Metric(type="plan")`, поэтому после сохранения участвует в тех же расчётах, что и ручной Plan.

## Financial Model

### Fact and Plan

`Metric`, `Budget` и `Cohort` хранят период в `period` и вариант в `type` (`fact` или `plan`). Уникальность задаётся по `(company_id, period, type)`.

- **Fact** — фактические данные месяца. Dashboard, Health и Unit Economics предпочитают последние Fact; отдельные сервисы допускают fallback на Plan при полном отсутствии Fact.
- **Plan** — плановые/прогнозные данные. Dashboard сравнивает Fact revenue с Plan revenue строго того же периода. Plan может быть введён вручную или сгенерирован AI.
- P&L строит окно из периодов Metric и Budget не позже текущего месяца. Для каждого периода Metric и Budget независимо выбираются по правилу `fact first, otherwise plan`. Поэтому возможен намеренный `source="mixed"` (например, Fact metric + Plan budget); это явно возвращается в `PnLMonth.source`.
- Future hiring берёт последнюю Plan metric, а при её отсутствии — Fact. Funding Need выводит growth сначала из двух Plan periods, затем из двух Fact periods, иначе использует 0%.

Нельзя считать любое fallback-значение фактом: downstream должен сохранять и показывать period/source semantics.

### P&L

Для каждого исторического/текущего периода:

```text
revenue = Metric.revenue
OPEX = Budget.fot + employer social payments
     + Budget.marketing + Budget.development + Budget.gna
EBITDA = revenue - OPEX
net_profit = EBITDA - loan interest
```

Налог на прибыль не моделируется. Loan interest рассчитывается по active loan schedule; investments на P&L не влияют. Текущий P&L использует `budget.fot`, а не role-based hiring payroll: это исторический/legacy контур, зафиксированный ниже как ограничение.

### Payroll

Canonical forecast payroll:

```text
HiringTeam (current headcount × salary)
    +
cumulative approved_hires by role and month
    +
employer insurance + injury contributions
    ↓
HiringService monthly payroll
    ↓
Cash Gap / Funding Need forecast
```

Legacy fallback:

```text
budget.fot + employer social payments
    ↓
forecast payroll only when HiringTeam is empty
```

`HiringService` строит 12 месяцев. Approved hires накапливаются: сотрудник, утверждённый в одном месяце, входит в payroll следующих месяцев. Recommended headcount рассчитывается детерминированно из revenue/new units/active units и role capacity constants; `generate_plan()` сохраняет recommended hires как approved по умолчанию, если ранее approval отсутствовал.

Фактическая интеграция пока неполная: только `CreditService` явно переключается на canonical payroll и не складывает его с `budget.fot`. P&L, Dashboard/Health, Unit Economics и Sensitivity продолжают читать `budget.fot`; Valuation получает FCF из этого P&L, хотя headcount берёт из HiringService. Это подтверждённое расхождение между forecast source of truth и частью финансовых consumers.

### Cash Flow

`CashFlowService` строится поверх P&L:

- operating CF = P&L net profit + amortization (сейчас константа 0);
- investing CF = `-CAPEX` (сейчас CAPEX — константа 0);
- financing CF месяца = investment/loan issuance по `issued_date`; legacy rows без даты относятся к первому месяцу окна;
- opening balance сейчас 0; closing balance накапливается хронологически.

Loan interest уже уменьшает P&L/net profit. Отдельные repayment of principal в фактическом Cash Flow не моделируются, несмотря на наличие term/first payment date в Financing. Поэтому Cash Flow нельзя интерпретировать как полный банковский график долга.

### Cash Gap and Funding Need

Текущий route/API сохраняет внутреннее legacy-имя `credit-forecast`, но пользовательские понятия — **Cash Gap** и **Funding Need**.

- Cash Gap — отрицательный `balance_before` конкретного будущего месяца в 12-месячной проекции.
- Для закрытия каждого gap рассчитывается financing amount = gap + 10% buffer.
- Funding Need — сумма этих financing amounts по всем gap periods.
- Начальный cash берётся из рассчитанного closing balance Cash Flow; OPEX разделён на non-payroll расходы и canonical forecast payroll.
- Для рекомендованного финансирования будущий debt service считается аннуитетным платежом. Для уже существующих loans forecast использует только текущий P&L interest как monthly debt service; principal repayments существующих loans в прогноз не добавляются.

Поля `total_credit_needed`, schema/class names `Credit*` и tab key `credit` остаются compatibility API/internal names и не должны возвращаться как основной продуктовый термин.

### Investments and loans

| Поведение | Investment | Loan |
|---|---|---|
| Persistence type | `investment` | `loan` |
| Основные поля | amount, issued date, investor type/counterparty | principal (`amount`), annual rate, term, repayment type, first payment date |
| P&L | не влияет | interest expense уменьшает net profit |
| Cash Flow issuance | financing inflow в месяц выдачи | financing inflow в месяц выдачи |
| Cash Flow repayment | не применимо | principal repayment сейчас не отражается |
| Aggregates | считается cash financing | считается debt |

`financing_sums()` агрегирует все строки без period/issued-date cutoff. Unit Economics и Health используют этот total как cash proxy; Dashboard использует total financing + accumulated operating profit. Это отличается от period-aware Cash Flow.

### Unit Economics, valuation and sensitivity

- Unit Economics: LTV/CAC, cohort retention, runway, Magic Number, payback и ROMI. Latest Fact предпочитается Plan; monthly burn берётся из latest Budget, включая `budget.fot` и employer social.
- Valuation: Gordon terminal value на annualized operating CF; discount rate = geography key rate + 10 percentage points, growth = configured geography inflation; equity value = terminal value − net debt. Headcount приходит из HiringService.
- Sensitivity: отдельные revenue, CAC, churn и combined stresses; OPEX stress использует P&L, включая `budget.fot`.
- Market analysis — локальная детерминированная таблица geography/industry assumptions, а не внешний market-data provider.
- Generic forecast endpoint использует NumPy linear/polynomial regression; optional Prophet path фактически деградирует к polynomial fallback, потому что Prophet не установлен.

## Frontend Architecture

### Routing and pages

`frontend/src/App.tsx` — источник route tree. Публичные routes: landing, login, register, invite. Protected layout содержит `/dashboard`, `/companies/:companyId`, `/recommendations`, `/forecast`, `/settings`; pages загружаются через `React.lazy`.

`Dashboard` выбирает experience по tenant/user context:

- fund admin видит portfolio dashboard (`CompaniesDashboard`);
- startup/company user с `companyId` видит `StartupDashboard`;
- пользователь без company access получает явное empty/no-access state.

Company deep dive живёт в `CompanyDetail` и переключает tabs через `?tab=`: metrics, cohorts, unit economics, budget, P&L, Cash Flow, financing, Cash Gap, valuation, sensitivity, market, hiring, tasks и reports.

### Navigation

`frontend/src/lib/navigation.ts` — canonical definition для:

- `globalNav`: Dashboard и Settings;
- `companyGroups`: сгруппированная company navigation и tab mapping.

Desktop использует sticky global `AppHeader` и `CompanyContextBar`. Mobile использует responsive sheet/dropdowns и ту же navigation model. **Постоянного desktop sidebar нет.** CompanyContextBar содержит company switcher для fund admin и горизонтальную grouped navigation для company context.

### State and contracts

- React Query — server state. Company-scoped keys строятся фабрикой `qk` с prefix `['tenant', tenantKey, ...]`.
- Zustand — persisted auth user. `authSession` полностью очищает QueryCache/MutationCache при logout, 401 и смене пользователя перед записью новой session.
- Backend Pydantic schemas/routes — canonical API contracts. `frontend/src/types/api.ts` — ручное consumer representation; `src/api/contract.test.ts` защищает несколько критичных mappings, но полной code generation нет.
- i18next содержит RU/EN resources; пользовательские строки должны идти через translations.
- UI primitives находятся локально в `src/components/ui`; Tailwind задаёт layout/design tokens.

## UX / Product Architecture

Dashboard/company experience следует потоку:

```text
DATA
  ↓
INSIGHT
  ↓
ACTION
```

- **DATA:** metrics, Plan/Fact trends, cohorts, budget, P&L, Cash Flow, unit economics и financing.
- **INSIGHT:** deterministic Business Health, attention signals, runway/valuation/sensitivity и AI narrative поверх рассчитанных данных.
- **ACTION:** `NextActions`, deep links в нужную вкладку, manual tasks и AI recommendations, конвертируемые в tasks.

`StartupDashboard` собирает KPI, performance chart, financial/unit blocks, cohorts и health, затем показывает AI insight и next actions. Portfolio dashboard агрегирует status/health компаний, Fact-vs-Plan performance и task progress.

## Multi-tenancy and Security

Tenant boundary реализован несколькими слоями:

1. JWT принимается из httpOnly `access_token` cookie или Bearer header; cookie имеет `SameSite=Lax`, а `Secure` управляется environment.
2. `get_current_user_full` загружает role/organization/company и устанавливает `ContextVar` tenant context на время request.
3. `require_company_access()` явно загружает company и проверяет: admin — organization ownership, остальные роли — точное совпадение assigned `company_id`.
4. SQLAlchemy `do_orm_execute` добавляет defense-in-depth filter по `organization_id`, но только для `Company` и `User`.
5. Остальные company-owned tables защищаются route dependency и обязательным `company_id` в service queries.
6. Frontend разделяет cache tenant-prefixed query keys и полностью очищает cache при session/user change.

Все просмотренные company-scoped routes используют `require_company_access`; write routes дополнительно ограничивают observer. Cross-tenant backend и frontend integration tests существуют.

Ограничение модели защиты: ORM-фильтр fail-open, когда tenant context не установлен, и не покрывает Metric/Budget/etc. Поэтому явная route dependency и company filtering являются частью security boundary, а не опциональной проверкой. Внутренние/background вызовы services должны сами сохранять этот контекст и scope.

## AI Architecture

`AI_PROVIDER` допускает только `deepseek`, `gigachat`, `demo`; default — `demo`. Реально реализованы:

- DeepSeek OpenAI-compatible `/chat/completions`; model берётся из `DEEPSEEK_MODEL` (default `deepseek-chat`);
- GigaChat auth + chat completion; model в request — `GigaChat`;
- deterministic demo responses без внешнего запроса.

Сценарии:

- общие unit-economics recommendations;
- company-aware recommendations с преобразованием в tasks;
- generation и persistence будущих Plan metrics из Fact history;
- narrative insights для overview, unit economics, cohorts, budget, readiness, hiring, P&L, Cash Flow, Cash Gap, valuation, sensitivity и reports.

При provider error `AIService` возвращает demo fallback. Recommendations также fallback-ятся при невалидном JSON; Plan generation валидирует parsed values и при ошибке сохраняет deterministic +5% demo plan. Application quota управляется единым feature flag `AI_QUOTA_ENABLED` и для пилота по умолчанию выключена; Subscription/plan usage architecture сохранена. SlowAPI rate limits и внешние provider limits продолжают действовать. Recommendation cache scoped по user и company context hash.

### Demo portfolio

`seed_demo_account` создаёт или детерминированно пересобирает отдельный tenant `Demo Venture Fund`. Demo admin имеет `company_id=NULL` и существующий unlimited plan `enterprise`; portfolio содержит `DEMO_COMPANY_COUNT` компаний (`1`, `5` или `10`, default `5`) с 6 Fact + 6 Plan metrics/budgets, HiringTeam и approved hires, cohorts, investment/loan financing и tasks. P&L, Cash Flow, Cash Gap / Funding Need, Unit Economics, Valuation и Sensitivity не сохраняются как fake rows, а рассчитываются штатными services.

Provisioning разрешён только при `DEMO_MODE=true` и наличии `DEMO_ACCOUNT_PASSWORD`. API `POST /api/v1/auth/seed` дополнительно требует header `X-Demo-Seed-Token` с этим секретом и ограничен rate limit; CLI использует тот же service:

```bash
cd backend
python scripts/seed_demo.py
```

Login email задаётся `DEMO_ACCOUNT_EMAIL` (default `demo@poicho.ru`), пароль — только environment variable `DEMO_ACCOUNT_PASSWORD`. Повторный запуск сбрасывает данные исключительно demo-tenant и не создаёт дубликаты.

AI не является источником P&L, Cash Flow, Cash Gap, valuation или health formulas: эти данные сначала считаются domain services, затем передаются модели для narrative. Исключение — генерация Plan, где AI предлагает входные Plan metrics, которые после валидации сохраняются. Ещё одно важное поведение: hiring insight вызывает `HiringService.generate_plan()` и поэтому может сохранить recommended/approved hiring rows до генерации narrative; этот endpoint не полностью read-only.

## Reports, Tasks and Supporting Capabilities

- Investor reports генерируются on demand в PDF (ReportLab + bundled DejaVu fonts) и XLSX (openpyxl).
- Weekly portfolio report формируется в HTML; admin endpoint отправляет его администраторам только текущей организации. SMTP — optional, при пустом `SMTP_HOST` отправка становится no-op.
- Readiness рассчитывается из task completion по четырём stages, а не хранится отдельным score.
- Analytics events сохраняются в БД; отдельной внешней analytics integration нет.

## Infrastructure and Deployment

### Development Compose

`docker-compose.yml` запускает PostgreSQL 15 Alpine, FastAPI с bind mount и Uvicorn `--reload`, Vite dev server с bind mount. DB наружу не публикуется; backend — `:8000`, frontend — `:5173`. Требуется `POSTGRES_PASSWORD`.

### Production

`docker-compose.prod.yml` использует GHCR images `ghcr.io/lorettef/mvp-backend:latest` и `mvp-frontend:latest`, PostgreSQL 15, restart/resource limits и healthcheck. Backend image запускает `alembic upgrade head` перед Uvicorn. Frontend image — multi-stage Node 20 build → Nginx static runtime.

Nginx:

- HTTP/8080 перенаправляет на HTTPS, кроме ACME challenge;
- HTTPS/443 отдаёт SPA и proxy `/api/`/`/health` в backend;
- TLS certificate копируется entrypoint-ом из Certbot volume; при первом старте генерируется временный self-signed certificate;
- Certbot renew работает отдельным container и reload/restart выполняется deploy hook.

### GitHub Actions

- `.github/workflows/test.yml`: backend pytest с coverage на PostgreSQL 15, затем Alembic upgrade/current/downgrade; frontend Vitest и production build. Lint отдельным CI step сейчас не запускается.
- `.github/workflows/deploy.yml`: push в `main`/manual trigger собирает и публикует backend/frontend images, затем по SSH обновляет production Compose, выполняет migration, healthcheck и cleanup old images.

## Testing

### Suites present

- Backend: 43 `test_*.py` files; фактически pytest собрал **290 tests**. Есть API/service regressions, Fact/Plan, payroll, financing, tenant isolation, auth/security, demo provisioning, reports и migration upgrade/downgrade tests.
- Frontend: 36 `*.test.ts(x)` files; Vitest фактически выполнил **202 tests**. Есть component/page/API tests и `crossTenant.integration.test.ts`.
- Browser E2E suite на Playwright/Cypress в репозитории не найден.

### Verification snapshot for this update

| Check | Result |
|---|---|
| `npm run test -- --run` | Passed: 36 files, 202 tests; есть non-failing React/Router warnings |
| `npx tsc --noEmit` | Passed |
| `npm run lint` | Passed with 0 errors and 6 warnings |
| `alembic heads` | Passed: `016_hiring_roles (head)` |
| Targeted backend: auth/demo/quota | Passed: 26 tests |
| Targeted backend: Budget/insights/company/tenant/hiring/financing/P&L/Cash Flow/Funding Need | Passed: 83 tests |
| Full backend pytest | **Not completed:** 290 tests collected; run reached 99% without a reported failure and was stopped by the explicit 300-second timeout. No full-suite pass is claimed. In-sandbox SQLite setup stalls; the successful runs above were repeated outside the sandbox against the local test database. |
| Vite production build | Passed; Vite reported only its non-failing large-chunk warning |

Intended local commands:

```bash
cd backend && pytest
cd frontend && npm run test -- --run
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
```

Migration tests perform clean SQLite upgrade-to-head and downgrade-to-base. CI additionally verifies the chain on PostgreSQL.

## Canonical Sources of Truth

| Область | Canonical source | Legacy/fallback/consumer notes |
|---|---|---|
| Product name | `backend/app/main.py`, `backend/app/core/config.py`, header/i18n | Не выводить имя из package/container/database legacy identifiers |
| Global/company navigation | `frontend/src/lib/navigation.ts` | `App.tsx` остаётся source of truth route tree; presentation находится в AppHeader/CompanyContextBar |
| API contracts | FastAPI routes + `backend/app/schemas/` | `frontend/src/types/api.ts` — ручной consumer mirror; Axios меняет response casing |
| Fact / Plan data | `Metric.type`, `Budget.type`, `Cohort.type`; selection helpers in `services/common.py` | Fact-first fallbacks и `mixed` P&L должны оставаться явными |
| Forecast payroll | `HiringService`: `HiringTeam + cumulative HiringPlanRow.approved_hires` | `budget.fot` — fallback только при пустом HiringTeam в Funding Need forecast; исторические consumers пока используют его напрямую |
| Financing records | `Financing` + `FinancingService` | Старое `credit` мигрировано в `loan`; compatibility `credit-*` names остаются в Cash Gap API |
| P&L | `PnLService` | Period-level Metric/Budget Fact-first; payroll пока `budget.fot` |
| Cash Flow | `CashFlowService` | Основан на P&L и issuance; principal repayment/CAPEX/opening cash ещё не полны |
| Cash Gap / Funding Need | `CreditService.forecast` | `funding_need` — основной output; `total_credit_needed` — compatibility alias |
| Unit Economics | `UnitEconomicsService` | Financing total используется как cash proxy |
| Health | `backend/app/core/health.py` rules + `HealthService`/Dashboard batching | Детерминированные сигналы, не AI score |
| Valuation | `ValuationService` | DB model `Valuation` не является активным расчётным источником |
| Tenant isolation | `require_company_access`, `get_current_user_full`, tenant ContextVar/filter, scoped service queries | ORM global filter ограничен Company/User; frontend qk/cache cleanup — дополнительный клиентский барьер |
| AI provider/fallback | `backend/app/core/config.py`, `AIService` | Runtime provider определяется environment; default/error fallback — demo |

## Known Architectural Constraints / Risks

| Status | Area | Подтверждённое текущее состояние |
|---|---|---|
| **Confirmed** | Payroll consumers | Canonical role-based payroll интегрирован в Funding Need forecast, но P&L, Dashboard/Health, Unit Economics и Sensitivity используют `budget.fot`; Valuation наследует P&L cash flow. Изменения payroll требуют проверки обеих цепочек. |
| **Confirmed** | Loan cash flows | Issuance и interest моделируются, но principal repayment существующих loans отсутствует в фактическом Cash Flow и existing-loan portion Funding Need forecast. |
| **Confirmed** | Cash semantics | `financing_sums`, Unit Economics, Health и Dashboard агрегируют все financing rows без period cutoff/repayment state; их cash/runway может отличаться от period-aware Cash Flow. |
| **Architectural constraint** | Fact/Plan | P&L разрешает mixed source по периоду, потому что Metric и Budget выбираются независимо. Consumer не должен маркировать mixed month как чистый Fact. |
| **Architectural constraint** | Tenant defense-in-depth | Global ORM tenant filter fail-open без context и охватывает только Company/User. Безопасность остальных сущностей зависит от route dependency и scoped service query. |
| **Confirmed** | AI side effects | Hiring insight вызывает `generate_plan()` и сохраняет hiring rows; AI insight route для этого scenario не является read-only. AI Plan generation также намеренно пишет Plan metrics. |
| **Confirmed** | SQLite company deletion | Явный compatibility cascade в `companies.py` не включает `HiringTeam` и `HiringPlanRow`. Поскольку test SQLite не включает FK enforcement, удаление company там может оставить эти строки; PostgreSQL `ON DELETE CASCADE` покрывает production path. |
| **Legacy compatibility** | Persistence/API | Legacy `HiringPlan` и `Valuation` tables/models остаются, хотя активные services используют другие расчётные paths; Cash Gap route/schema всё ещё имеют `credit` naming. |
| **Needs follow-up audit** | Backend verification | Полный pytest suite достиг 99%, но был остановлен установленным 300-секундным timeout, поэтому полный pass не подтверждён. Изменённые и соседние доменные области покрыты отдельными зелёными наборами (109 tests); PostgreSQL CI в этой сессии не проверялся. |

## Current Project Status

Реализованы multi-tenant registration/invites и role access, portfolio/startup dashboards, company lifecycle, Plan/Fact metrics and cohorts, budgets, hiring, tasks/readiness, deterministic financial analytics, financing CRUD, reports, AI recommendations/insights/Plan generation, localization и containerized deployment.

Текущая архитектура — рабочая full-stack система с FastAPI service layer и React SPA, а не завершённость некоторого внешнего ТЗ. Известные ограничения сосредоточены в консолидации payroll consumers, полноте loan/cash modeling, bounded tenant defense-in-depth и воспроизводимости полного backend test run. Следующие изменения финансовой логики должны начинаться с таблицы canonical sources выше и проверять все downstream consumers, не создавая параллельный расчётный движок.
