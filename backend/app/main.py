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
from app.api.v1 import auth, metrics, recommendations, forecast, subscription, companies, dashboard, cohorts, budgets, unit_economics, tasks, market, hiring, pnl, cashflow, credit, valuation

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
app.include_router(market.router, prefix="/api/v1/market", tags=["market"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["dashboard"])
app.include_router(
    subscription.router,
    prefix="/api/v1/subscription",
    tags=["subscription"]
)

@app.get("/health")
async def health_check():
    """Проверка работоспособности."""
    return {
        "status": "ok",
        "service": "Startup Engine API",
        "version": "1.0.0"
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