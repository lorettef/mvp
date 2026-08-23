<h1 align="center">🚀 Startup Engine</h1>
<h3 align="center">Операционная система для акселераторов и венчурных фондов</h3>

<p align="center">
  <img src="https://img.shields.io/badge/react-18.3-61dafb?logo=react" alt="React">
  <img src="https://img.shields.io/badge/fastapi-0.115-009688?logo=fastapi" alt="FastAPI">
  <img src="https://img.shields.io/badge/python-3.12-3776ab?logo=python" alt="Python">
  <img src="https://img.shields.io/badge/лицензия-Проприетарная-red" alt="License">
</p>

---

## Что такое Startup Engine?

B2B-платформа для управления портфелем стартапов: акселераторы и венчурные фонды ведут в ней свои компании, отслеживают метрики «План vs Факт», анализируют юнит-экономику, готовят компании к продаже и формируют отчёты для инвесторов.

Платформа **мультитенантная**: у каждого акселератора своя организация, внутри — компании и пользователи с ролевым доступом.

### ✨ Возможности

**Портфель и компании**
- Дашборд портфеля — агрегаты (средние MRR/CAC/LTV/Churn, % выполняющих план) и таблица компаний со статусами
- Страница компании — 13 вкладок: Метрики, Когорты, Бюджет, Юнит-экономика, Задачи, Рынок, Найм, P&L, Cash Flow, Кредиты, Оценка, Чувствительность, Отчёты
- Метрики «План vs Факт» с отклонениями и трендами (красный/зелёный)

**Аналитика и финансы**
- Юнит-экономика: Runway, LTV/CAC, Magic Number, Retention (M1/M3/M6/M12) + диагностика
- Когортное удержание и бюджет (Маркетинг/Разработка/ФОТ/G&A)
- Финансовый модуль: P&L, Cash Flow, умное прогнозирование кредитов (кассовый разрыв + буфер 10%, ставка = ключевая + 5%), оценка бизнеса по модели Гордона, анализ чувствительности
- Внешний анализ рынка (макро, объём, тренды) с влиянием на метрики
- Прогноз найма с настраиваемыми соц. платежами (НДФЛ/взносы/травматизм)

**Система задач — главное УТП**
- Этапы готовности к продаже: Метрики → Документы → Переговоры → Презентация
- Вывод «Готовность N%» + риски по незавершённым этапам

**AI (12 сценариев)**
- AI-рекомендации по улучшению метрик
- Генерация плана метрик («Сгенерировать план AI»)
- AI-инсайты (нарративы) по каждому аналитическому модулю
- Провайдеры: **DeepSeek** (рекомендован) и **GigaChat**, с детерминированным demo-фолбэком

**Отчёты и монетизация**
- Отчёты для инвесторов: PDF (ReportLab) + Excel (openpyxl)
- Тарифы Starter / Pro / Business / Enterprise с лимитами компаний и AI-запросов
- Принудительный пересчёт всех прогнозов одной кнопкой

### 👥 Роли

| Роль | Доступ |
|------|--------|
| **Администратор** (акселератор) | Полный доступ ко всем компаниям, настройкам, отчётам |
| **Компания** (стартап) | Только свои данные (ввод Плана и Факта) |
| **Наблюдатель** (инвестор) | Только просмотр отчётов (read-only) |

---

## 🏗 Архитектура

```
┌────────────────────────────────────────────────────────────────┐
│                      КЛИЕНТ (Браузер)                           │
│   React 18 · TypeScript · shadcn/ui · Tailwind · Recharts       │
│                                                                │
│   Дашборд │ Компания (13 вкладок) │ AI │ Настройки              │
└──────────────────────────┬─────────────────────────────────────┘
                           │  HTTPS / REST API
                           ▼
┌────────────────────────────────────────────────────────────────┐
│                      Nginx (reverse proxy)                      │
└──────────────────────────┬─────────────────────────────────────┘
                           │
┌──────────────────────────┴─────────────────────────────────────┐
│                    FastAPI (Python 3.12)                        │
│   /auth/*  /companies/*  /dashboard/*  /subscription/*          │
│   JWT + httpOnly cookie · RBAC · rate limiting                  │
└──────┬───────────────────────────────┬─────────────────────────┘
       │                               │
       ▼                               ▼
┌─────────────┐              ┌─────────────────┐
│ PostgreSQL  │              │  DeepSeek API   │
│ (или SQLite)│              │  GigaChat API   │
└─────────────┘              └─────────────────┘
```

---

## 🛠 Стек технологий

| Слой | Технологии |
|------|-----------|
| **Фронтенд** | React 18 · TypeScript 5 · Tailwind CSS 3 · shadcn/ui · Vite · Recharts |
| **Стейт-менеджмент** | Zustand · TanStack React Query |
| **Бэкенд** | FastAPI 0.115 · Python 3.12 · Pydantic 2 · SQLAlchemy 2 (async) |
| **База данных** | PostgreSQL 15 (production) · SQLite (разработка/тесты) |
| **Аутентификация** | JWT + httpOnly cookie · bcrypt · rate limiting |
| **AI** | DeepSeek API · GigaChat API · Prophet · demo-фолбэк |
| **Отчёты** | ReportLab (PDF) · openpyxl (Excel) |
| **Инфраструктура** | Docker Compose · Nginx · GitHub Actions CI/CD |
| **Тестирование** | Vitest + Testing Library (фронт) · Pytest + pytest-asyncio (бэк) |

---

## 🚀 Быстрый старт

### Требования
- Docker и Docker Compose

### 1. Клонирование и настройка

```bash
git clone <repo-url>
cd <project-dir>

# Переменные окружения (Docker Compose)
cp .env.example .env

# Настройки бэкенда (AI-провайдер и ключи)
cp backend/.env.example backend/.env
```

> **AI-провайдер**: по умолчанию `AI_PROVIDER=deepseek` — добавьте `DEEPSEEK_API_KEY`. Без ключа AI-функции автоматически падают на детерминированный demo-режим (правила вместо нейросети).

### 2. Запуск через Docker

```bash
# Режим разработки (hot reload)
docker compose up -d

# Production (Nginx + собранные фронт-образы)
docker compose -f docker-compose.prod.yml up -d
```

### 3. Доступ

| Сервис | URL |
|--------|-----|
| Фронтенд | http://localhost:5173 |
| Бэкенд API | http://localhost:8000 |
| Swagger | http://localhost:8000/docs |

### 4. Локальная разработка (без Docker)

```bash
# Бэкенд
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Фронтенд (другой терминал)
cd frontend
npm install
npm run dev
```

> **Демо-доступ**: при `DEMO_MODE=true` на странице входа доступна кнопка «Быстрый демо-доступ» — мгновенный вход с предзаполненными данными.

---

## 💰 Тарифы

| Тариф | Цена | Лимит компаний | Возможности |
|-------|------|:---:|-------------|
| **Starter** | 0 ₽ | 2 | Демо 3 мес, базовый дашборд, 1 AI-отчёт/мес |
| **Pro** | 19 000 ₽ (+1 900/компания) | до 10 | + Когорты, экспорт Excel, 5 AI-отчётов/мес |
| **Business** | 39 000 ₽ (+2 900/компания) | до 25 | + полный фин. модуль (P&L, Cash Flow, Оценка), PDF-отчёты |
| **Enterprise** | индивидуально | >25 | + кастомизация |

---

## 📂 Структура проекта

```
├── frontend/                    # React 18 + TypeScript + shadcn/ui
│   ├── src/
│   │   ├── api/                 # Axios-клиент и модули endpoint'ов
│   │   ├── components/
│   │   │   ├── common/          # Layout, ProtectedRoute, ErrorBoundary
│   │   │   ├── company/         # 13 вкладок страницы компании + AIInsight
│   │   │   └── ui/              # shadcn/ui-компоненты
│   │   ├── pages/               # Dashboard, CompanyDetail, Recommendations, …
│   │   ├── store/               # Zustand-стор (persist в localStorage)
│   │   └── types/               # Общие типы API-контрактов
│   └── package.json
│
├── backend/                     # FastAPI + SQLAlchemy (async)
│   ├── app/
│   │   ├── api/v1/              # Роуты (auth, companies, dashboard, financial, AI, …)
│   │   ├── core/                # Конфиг, БД, безопасность, тарифы, rate limiter
│   │   ├── models/              # SQLAlchemy-модели (мультитенантность)
│   │   ├── schemas/             # Pydantic-схемы
│   │   └── services/            # Бизнес-логика (auth, AI, финансы, отчёты, …)
│   ├── alembic/                 # Миграции БД
│   ├── tests/                   # Pytest-тесты
│   └── requirements.txt
│
├── nginx/                       # Конфигурация Nginx для production
├── scripts/                     # Деплой и утилиты
├── .github/workflows/           # CI/CD (test, build-images, deploy)
├── docker-compose.yml           # Docker для разработки
└── docker-compose.prod.yml      # Docker для production
```

---

## 🧪 Тестирование

```bash
# Бэкенд
cd backend
pytest

# Фронтенд
cd frontend
npm run test
```

---

## 📦 Деплой

Деплой через GitHub Actions при пуше в `main`.

**Секреты репозитория**: `SERVER_HOST`, `SERVER_USER`, `SSH_PRIVATE_KEY`.

Ручной деплой:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

---

## 📄 Лицензия

Проприетарная. Все права защищены. Подробнее в [LICENSE](LICENSE).
