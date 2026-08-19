# TODO: Изменения в проекте перед выходом на рынок

## Блок 1 — Срочное (неделя 1)

### 1.1 Корневой `.env.example`

**Проблема**: после `git clone` нельзя запустить `docker compose up -d` — не хватает переменных `POSTGRES_PASSWORD`, `POSTGRES_USER`, `POSTGRES_DB`. Они нужны в корне, рядом с `docker-compose.yml`.

**Файл**: `/backend/.env.example` существует, но в нём нет отдельных `POSTGRES_*` переменных — только готовый `DATABASE_URL`. Нужно создать отдельный `/.env.example` в корне проекта.

**Новый файл**: `/.env.example`
```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=changeme
POSTGRES_DB=startup_engine
```

**Обновить README.md**: в секции «Быстрый старт» заменить «cp backend/.env.example backend/.env» на «cp .env.example .env». Плюс добавить «cp backend/.env.example backend/.env» для настроек AI.

---

### 1.2 Убрать ложный Prophet

**Проблема**: кнопка «Prophet (продвинутый)» в интерфейсе вызывает не библиотеку Meta Prophet, а обычную квадратичную регрессию `numpy.polyfit`. Библиотеки Prophet нет в `requirements.txt`. Это введение пользователя в заблуждение.

**Исправить**:
- Файл: `backend/app/services/forecast_service.py` — удалить функцию `prophet_forecast` (она просто алиас на `polynomial_forecast`)
- Файл: `backend/app/schemas/forecast.py` — убрать `"prophet"` из `Literal["linear", "polynomial", "prophet"]`
- Файл: `frontend/src/pages/Forecast.tsx` — переименовать «Prophet (продвинутый)» → «Квадратичная регрессия» в выпадающем списке методов
- Файл: `frontend/src/types/api.ts` — убрать `"prophet"` из типа

**или**

**Вариант 2 — Добавить настоящий Prophet**:
- `pip install prophet` (или `pip install neuralprophet` для современного форка)
- Переписать `prophet_forecast` на реальный вызов: обучить модель → предсказать → вернуть прогноз + доверительный интервал
- Заменить хардкодный ±10% confidence interval на настоящий от Prophet
- Обновить `requirements.txt`

**Рекомендация**: добавить настоящий Prophet. На демо-дне акселератора график с доверительными интервалами от реальной ML-модели — это сильный аргумент.

---

### 1.3 Включить реальный AI (DeepSeek) по умолчанию

**Проблема**: `AI_PROVIDER=demo` в `.env.example` — пользователи никогда не видят реальный AI. Все рекомендации генерируются жёстко закодированными правилами.

**Исправить**:
- Файл: `backend/.env.example` — `AI_PROVIDER=deepseek` (или `gigachat`), убрать `demo` как дефолт
- Файл: `docker-compose.yml` — добавить `DEEPSEEK_API_KEY` в `environment` сервиса `backend` (брать из `.env`)
- Оставить `demo` как fallback при ошибках API (уже работает в `ai_service.py`)

---

### 1.4 Показывать источник AI в ответе

**Проблема**: пользователь не знает, с кем общается — с настоящим LLM или демо-режимом. Это снижает доверие и восприятие ценности AI.

**Исправить**:
- Файл: `backend/app/schemas/recommendations.py` — добавить поле `provider: Literal["deepseek", "gigachat", "demo"]` в `RecommendationResponse`
- Файл: `backend/app/services/ai_service.py` — заполнять поле `provider` в ответе, в зависимости от того, какой провайдер сгенерировал рекомендации
- Файл: `frontend/src/pages/Recommendations.tsx` — показывать бейдж «AI (DeepSeek)» или «Базовая рекомендация» в зависимости от `provider`

---

## Блок 2 — Честность README (неделя 1)

### 2.1 Убрать несуществующие фичи из README

**Проблема**: README обещает то, чего нет в коде:
- **«Система задач»** — во введении: «Объединяет дашборд с ключевыми метриками, AI-рекомендации от GigaChat, прогнозирование роста и систему задач». Слов про «систему задач» нет ни в одном файле проекта.
- **«Экспорт PDF»** — в тарифах Pro: «экспорт PDF». Нет ни строчки кода, ни библиотеки для PDF.
- **«Кастомные промпты»** — в тарифе Business. Не реализовано.
- **Prophet** — про него уже сказано.

**Исправить**: удалить упоминания несуществующих фич из README. Всё, что написано, должно работать здесь и сейчас.

---

### 2.2 Поправить описание AI-провайдеров

**Проблема**: в README указан только GigaChat, а в коде поддержаны DeepSeek и GigaChat. DeepSeek дешевле, быстрее и не требует OAuth-токена.

**Исправить**: обновить секцию AI в README — упомянуть DeepSeek как рекомендуемый, GigaChat как альтернативу.

---

### 2.3 Поправить тариф Business

**Проблема**: в README и в `Settings.tsx` написано «∞ безлимит» для Business, а в коде (`subscription_service.py:13-17`) жёсткий лимит 50 запросов/день.

**Исправить**:
- Либо поднять лимит до действительно высокого (например, 1000/день) и написать «практически безлимитный»
- Либо изменить `PLAN_LIMITS["business"]` на `float("inf")` и добавить проверку в `check_limit`
- Либо честно написать «50 запросов/день» везде

---

## Блок 3 — Retention (месяц 1–2)

### 3.1 Перенести метрики из localStorage на сервер

**Проблема**: метрики живут только в браузере пользователя. Нет истории, нет графиков изменений, нет повода вернуться.

**Сделать**:
- Файл: `backend/app/models/metrics.py` (новый) — модель `MetricSnapshot`: user_id, date, mrr, cac, ltv, churn, arpu, runway, active_users, created_at
- Файл: `backend/alembic/versions/` — миграция для новой таблицы
- Файл: `backend/app/api/v1/metrics.py` — добавить POST `/save` и GET `/history` эндпоинты
- Файл: `backend/app/services/metrics_service.py` (новый) — логика сохранения и получения истории
- Файл: `frontend/src/api/metrics.ts` — добавить вызовы save и history
- Файл: `frontend/src/pages/Dashboard.tsx` — при сохранении метрик отправлять их на сервер, показывать график изменений (Recharts)
- Файл: `frontend/src/store/authStore.ts` — убрать хранение метрик из Zustand/localStorage

### 3.2 Еженедельный email-отчёт

**Проблема**: нет механики возврата пользователя.

**Сделать**:
- Файл: `backend/app/services/email_service.py` (новый) — отправка email через SMTP (или сервис вроде SendGrid)
- Файл: `backend/app/services/report_service.py` (новый) — генерация недельного отчёта: динамика метрик, сравнение с прошлой неделей, 1 рекомендация
- Файл: `backend/app/tasks/` (новый) — Celery/фоновый воркер для еженедельной рассылки
- Или проще: использовать внешний сервис (например, Resend + Vercel Cron) без Celery

### 3.3 Аналитика событий

**Проблема**: ты не знаешь, что пользователи делают в продукте.

**Сделать** (минимально):
- Файл: `backend/app/api/v1/analytics.py` (новый) — POST `/track` эндпоинт для событий
- События: `demo_activated`, `registered`, `metrics_analyzed`, `recommendations_requested`, `forecast_requested`, `session_started`
- Файл: `frontend/src/api/analytics.ts` (новый) — клиент для отправки событий
- Вставить вызовы `analytics.track(...)` в ключевые места: Login.tsx, Dashboard.tsx, Recommendations.tsx, Forecast.tsx

---

## Блок 4 — Багфиксы (неделя 1)

### 4.1 Починить logout

**Проблема**: кнопка «Выйти» в Layout.tsx очищает только Zustand-стейт на фронтенде. Не вызывает `POST /auth/logout` — cookie JWT остаётся в браузере. Обновление страницы → пользователь снова залогинен.

**Исправить**:
- Файл: `frontend/src/store/authStore.ts` — в `logout()` вызывать `authApi.logout()`
- Файл: `frontend/src/components/common/Layout.tsx` — после логаута редиректить на `/login`

### 4.2 Убрать мёртвый код

**Проблема**: определённые, но нигде не используемые функции:
- `frontend/src/api/subscription.ts` — `subscriptionApi.status()` и `subscriptionApi.update()` не вызываются ни с одной страницы. `update()` вызывает эндпоинт, которого нет на бэкенде.
- `frontend/src/store/authStore.ts` — `updateSubscription` определён, но нигде не вызывается.
- `backend/app/core/config.py` — `FREE_DAILY_LIMIT`, `PRO_DAILY_LIMIT`, `BUSINESS_DAILY_LIMIT`, `RATE_LIMIT_FREE`, `RATE_LIMIT_PRO`, `RATE_LIMIT_BUSINESS` — нигде не используются. Реальные лимиты живут в `subscription_service.py:PLAN_LIMITS`.

**Исправить**: удалить неиспользуемый код или задокументировать, зачем он оставлен.

### 4.3 Починить счётчик использованных запросов для `/metrics/analyze`

**Проблема**: `POST /metrics/analyze` проверяет дневной лимит (может вернуть 429), но никогда не инкрементирует счётчик `used_today`, потому что `AICache`-записи создаются только в `ai_service.py`, а `metrics/analyze` использует `AnalyticsService.analyze_metrics` (чистая функция без записи в БД). Бесплатный пользователь может вызывать анализ метрик неограниченно.

**Исправить**:
- Вариант 1: не применять AI-лимит к `/metrics/analyze` — это не AI-запрос, а локальное вычисление
- Вариант 2: записывать факт использования в отдельную таблицу (не `AICache`) и считать оттуда

---

## Блок 5 — Английская версия (месяц 2–3)

### 5.1 i18n и английский лендинг

**Проблема**: весь интерфейс на русском. Российский рынок pre-seed SaaS мал (~500–1000 команд). Для акселератора и инвесторов нужен выход на глобальный рынок.

**Сделать**:
- Файл: `frontend/src/i18n/` (новый) — `react-i18next` с переводами
- Файл: `frontend/src/pages/Landing.tsx` (новый) — англоязычная посадочная страница
- Перевести все страницы и сообщения бэкенда на английский (с русским как fallback)
- Product Hunt-запуск после перевода

---

## Приоритеты: что делать прямо сейчас

| № | Что | Почему это первое |
|---|---|---|
| 1 | `.env.example` в корне | Без этого никто не запустит проект. Даже ты после `git clone`. |
| 2 | Убрать/заменить Prophet | Репутационный риск. Самое уязвимое место на демо-дне. |
| 3 | Включить DeepSeek по умолчанию | Демо-AI неотличим от правил. Реальный AI → реальная ценность. |
| 4 | Исправить README (убрать несуществующее) | Честность с инвесторами. |
| 5 | 10 разговоров с фаундерами | Не код. Самый важный пункт для понимания, что строить. |
| 6 | Аналитика событий | Ты не знаешь, что делают пользователи. Без этого нет данных для акселератора. |
| 7 | Перенос метрик на сервер | Механика retention. Без этого пользователь не возвращается. |
| 8 | Email-отчёты | Ещё одна механика возврата. |
| 9 | i18n / английская версия | Выход на глобальный рынок. |
