import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.config import settings
from app.core.limiter import limiter
from app.core.database import engine
from app.api.v1 import auth, metrics, recommendations, forecast, subscription, companies, dashboard, cohorts, budgets, unit_economics, tasks, market, hiring, pnl, cashflow, credit, valuation, sensitivity, reports, recalculate, plan_generation, insights, analytics, admin, invites, catalog

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Управление жизненным циклом приложения."""
    logger.info("Startup Engine API starting")
    yield
    try:
        await engine.dispose()
        logger.info("Соединения закрыты")
    except Exception as e:
        logger.error(f"Ошибка при закрытии соединений: {e}")

# Создание приложения
app = FastAPI(
    title="Startup Engine API",
    version="1.0.0",
    description="Гибридная платформа для управления юнит-экономикой",
    lifespan=lifespan
)

# Rate limiter integration
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS (только разрешённые домены)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    expose_headers=["*"]
)

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# Регистрация роутов
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(invites.router, prefix="/api/v1/invites", tags=["invites"])
app.include_router(metrics.router, prefix="/api/v1/metrics", tags=["metrics"])
app.include_router(
    recommendations.router,
    prefix="/api/v1/recommendations",
    tags=["recommendations"]
)
app.include_router(forecast.router, prefix="/api/v1/forecast", tags=["forecast"])
app.include_router(companies.router, prefix="/api/v1/companies", tags=["companies"])
app.include_router(cohorts.router, prefix="/api/v1/companies", tags=["cohorts"])
app.include_router(budgets.router, prefix="/api/v1/companies", tags=["budgets"])
app.include_router(unit_economics.router, prefix="/api/v1/companies", tags=["unit-economics"])
app.include_router(tasks.router, prefix="/api/v1/companies", tags=["tasks"])
app.include_router(hiring.router, prefix="/api/v1/companies", tags=["hiring"])
app.include_router(pnl.router, prefix="/api/v1/companies", tags=["pnl"])
app.include_router(cashflow.router, prefix="/api/v1/companies", tags=["cashflow"])
app.include_router(credit.router, prefix="/api/v1/companies", tags=["credit"])
app.include_router(valuation.router, prefix="/api/v1/companies", tags=["valuation"])
app.include_router(sensitivity.router, prefix="/api/v1/companies", tags=["sensitivity"])
app.include_router(reports.router, prefix="/api/v1/companies", tags=["reports"])
app.include_router(recalculate.router, prefix="/api/v1/companies", tags=["recalculate"])
app.include_router(plan_generation.router, prefix="/api/v1/companies", tags=["plan-generation"])
app.include_router(insights.router, prefix="/api/v1/companies", tags=["insights"])
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["analytics"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(market.router, prefix="/api/v1/market", tags=["market"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["dashboard"])
app.include_router(
    subscription.router,
    prefix="/api/v1/subscription",
    tags=["subscription"]
)
app.include_router(catalog.router, prefix="/api/v1/catalog", tags=["catalog"])

@app.get("/health")
async def health_check():
    """Проверка работоспособности."""
    return {
        "status": "ok",
        "service": "Startup Engine API",
        "version": "1.0.0",
        "demo_mode": settings.DEMO_MODE
    }

@app.get("/")
async def root():
    """Корневой эндпоинт."""
    return {
        "service": "Startup Engine",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }