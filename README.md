<h1 align="center">🚀 Startup Engine</h1>
<h3 align="center">Операционная система для pre-seed SaaS стартапов</h3>

<p align="center">
  <a href="https://github.com/NickNewill/startup_engine/actions/workflows/test.yml"><img src="https://github.com/NickNewill/startup_engine/actions/workflows/test.yml/badge.svg" alt="Test"></a>
  <a href="https://github.com/NickNewill/startup_engine/actions/workflows/deploy.yml"><img src="https://github.com/NickNewill/startup_engine/actions/workflows/deploy.yml/badge.svg" alt="Deploy"></a>
  <img src="https://img.shields.io/badge/react-18.3-61dafb?logo=react" alt="React">
  <img src="https://img.shields.io/badge/fastapi-0.115-009688?logo=fastapi" alt="FastAPI">
  <img src="https://img.shields.io/badge/лицензия-Проприетарная-red" alt="License">
</p>

---

## Что такое Startup Engine?

Гибридная платформа для управления юнит-экономикой SaaS-стартапов на ранней стадии. Объединяет **дашборд с ключевыми метриками**, **AI-рекомендации** от GigaChat, **прогнозирование роста** и **систему задач** — помогая фаундерам принимать решения на основе данных.

> **Ваши данные — ваши.** Метрики хранятся локально в браузере (localStorage). На сервер отправляются только агрегированные показатели для AI-анализа.

### ✨ Возможности

- **📊 Дашборд** — MRR, CAC, LTV, Churn, ARPU, Runway. Редактируемые карточки метрик с анализом здоровья бизнеса в реальном времени
- **🤖 AI-рекомендации** — Персональные советы от GigaChat (Сбер) на основе ваших метрик, с приоритетами и категориями
- **📈 Прогнозирование** — Предсказание роста MRR: линейная регрессия, квадратичная регрессия, Prophet
- **🎨 Тёмная и светлая темы** — Интерфейс на [shadcn/ui](https://ui.shadcn.com), тёмная тема по умолчанию, переключатель в один клик
- **🔐 JWT-аутентификация** — httpOnly cookies, bcrypt-хэширование паролей, rate limiting на критичных endpoint'ах
- **🚀 Демо-доступ** — Мгновенный вход без регистрации: кнопка «Быстрый демо-доступ» на странице логина

---

## 🏗 Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                        КЛИЕНТ (Браузер)                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              React 18 · TypeScript · shadcn/ui             │  │
│  │              Tailwind CSS · Vite · Recharts               │  │
│  │                                                           │  │
│  │   Дашборд  │  AI-рекомендации  │  Прогноз  │  Настройки   │  │
│  └──────────────────────┬────────────────────────────────────┘  │
└─────────────────────────┼───────────────────────────────────────┘
                          │  HTTPS / REST API
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      СЕРВЕР (Облако / VPS)                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   Nginx (reverse proxy)                    │  │
│  └──────────────────────┬────────────────────────────────────┘  │
│                         │                                       │
│  ┌──────────────────────┴──────────────────────────────────┐   │
│  │                  FastAPI (Python 3.12)                    │   │
│  │                                                          │   │
│  │   /auth/*    │  /metrics/*  │  /forecast/*               │   │
│  │   JWT        │  Анализ      │  Прогнозы                  │   │
│  │                                                          │   │
│  │   /recommendations/*  │  /subscription/*                 │   │
│  │   GigaChat AI          │  Тарифы и лимиты                │   │
│  └──────┬──────────────────────────────────┬────────────────┘   │
│         │                                  │                    │
│         ▼                                  ▼                    │
│  ┌─────────────┐                  ┌─────────────────┐          │
│  │ PostgreSQL  │                  │  GigaChat API   │          │
│  │ (или SQLite)│                  │  (Сбер)         │          │
│  └─────────────┘                  └─────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠 Стек технологий

| Слой | Технологии |
|------|-----------|
| **Фронтенд** | React 18 · TypeScript 5.7 · Tailwind CSS 3.4 · [shadcn/ui](https://ui.shadcn.com) · Vite 5 |
| **Стейт-менеджмент** | Zustand 5 · TanStack React Query 5 |
| **Графики** | Recharts 2 |
| **Бэкенд** | FastAPI 0.115 · Python 3.12 · Pydantic 2 · SQLAlchemy 2 (async) |
| **База данных** | PostgreSQL 15 (production) · SQLite (разработка) |
| **Аутентификация** | PyJWT · bcrypt · httpOnly cookies |
| **AI** | GigaChat API (Сбер) с демо-режимом |
| **Инфраструктура** | Docker Compose · Nginx · GitHub Actions CI/CD |
| **Тестирование** | Vitest + Testing Library (фронт) · Pytest + pytest-asyncio (бэк) |

---

## 🚀 Быстрый старт

### Требования
- [Docker](https://docs.docker.com/get-docker/) и Docker Compose
- [Git](https://git-scm.com/)

### 1. Клонирование и настройка

```bash
git clone https://github.com/NickNewill/startup_engine.git
cd startup_engine

# Настройка переменных окружения
cp .env.example .env            # переменные для Docker Compose (POSTGRES_*)
cp backend/.env.example backend/.env
# Отредактируйте backend/.env — добавьте ключи AI-провайдера (опционально)
# AI_PROVIDER=demo работает из коробки для локальной разработки
```

### 2. Запуск через Docker (рекомендуется)

```bash
# Режим разработки (hot reload, открытые порты)
docker compose up -d

# Production-режим (Nginx, оптимизированные сборки)
docker compose -f docker-compose.prod.yml up -d
```

### 3. Доступ к приложению

| Сервис | URL |
|--------|-----|
| Фронтенд | http://localhost:5173 |
| Бэкенд API | http://localhost:8000 |
| Документация API (Swagger) | http://localhost:8000/docs |

### 4. Локальная разработка (без Docker)

```bash
# Бэкенд
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Фронтенд (в другом терминале)
cd frontend
npm install
npm run dev
```

> **Демо-режим**: нажмите **«Быстрый демо-доступ»** на странице входа — мгновенный доступ ко всем функциям с предзаполненными данными. Регистрация не требуется при `DEMO_MODE=true`.

---

## 💰 Тарифы

| Тариф | Цена | AI-запросов/день | Возможности |
|-------|------|:---:|-------------|
| **Starter** | Бесплатно | 1 | Базовый дашборд, 1 AI-рекомендация |
| **Pro** | $19/мес | 10 | Всё выше + прогнозы, экспорт PDF |
| **Business** | $49/мес | ∞ | Всё выше + кастомные промпты, приоритет |

---

## 📂 Структура проекта

```
startup_engine/
├── frontend/                    # React 18 + TypeScript + shadcn/ui
│   ├── src/
│   │   ├── api/                 # Axios-клиент и модули endpoint'ов
│   │   ├── components/
│   │   │   ├── common/          # Layout, ProtectedRoute, ErrorBoundary, StatCard
│   │   │   ├── ui/              # shadcn/ui-компоненты (Button, Card, Input, …)
│   │   │   ├── theme-provider.tsx
│   │   │   └── theme-toggle.tsx
│   │   ├── pages/               # Dashboard, Login, Register, Recommendations,
│   │   │                          Forecast, Settings
│   │   ├── store/               # Zustand-стор (persist в localStorage)
│   │   ├── types/               # Общие типы API-контрактов
│   │   ├── lib/                 # Утилита cn()
│   │   └── test/                # Настройка тестов + моки
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── package.json
│
├── backend/                     # FastAPI + SQLAlchemy (async)
│   ├── app/
│   │   ├── api/v1/              # Роуты (auth, metrics, forecast,
│   │   │                          recommendations, subscription)
│   │   ├── core/                # Конфиг, БД, безопасность, rate limiter
│   │   ├── models/              # SQLAlchemy-модели (User, Subscription, AICache, AuditLog)
│   │   ├── schemas/             # Pydantic-схемы запросов/ответов
│   │   └── services/            # Бизнес-логика (auth, AI, аналитика, forecast, seed)
│   ├── alembic/                 # Миграции базы данных
│   ├── tests/                   # Pytest-тесты
│   └── requirements.txt
│
├── nginx/                       # Конфигурация Nginx для production
├── scripts/                     # Деплой и утилиты
├── .github/workflows/           # CI/CD (test.yml, deploy.yml)
├── .env.example                 # Пример переменных окружения для Docker Compose
├── docker-compose.yml           # Docker для разработки
└── docker-compose.prod.yml      # Docker для production
```

---

## 🧪 Тестирование

```bash
# Бэкенд
cd backend
pytest --cov=app

# Фронтенд
cd frontend
npm run test
```

---

## 📦 Деплой

Проект автоматически деплоится через GitHub Actions при пуше в `main`.

**Секреты репозитория:**

| Секрет | Описание |
|--------|----------|
| `SERVER_HOST` | IP-адрес сервера |
| `SERVER_USER` | Пользователь SSH |
| `SSH_PRIVATE_KEY` | Приватный ключ для SSH-доступа |

Ручной деплой:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

---

## 🤝 Участие в разработке

1. Форкните репозиторий
2. Создайте ветку: `git checkout -b feature/название-фичи`
3. Внесите изменения с тестами
4. Убедитесь, что `npm run build && pytest` проходит
5. Используйте [conventional commits](https://www.conventionalcommits.org/)
6. Запушьте и откройте Pull Request

---

## 📄 Лицензия

Проприетарная. Все права защищены. Подробнее в [LICENSE](LICENSE).

---

<p align="center">
  Разработчик: <a href="https://github.com/NickNewill">NickNewill</a> · <a href="https://startupengine.ru">startupengine.ru</a>
</p>
