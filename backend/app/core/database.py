from sqlalchemy.ext.asyncio import (
    AsyncSession,
    create_async_engine,
    async_sessionmaker
)
from sqlalchemy import event
from sqlalchemy.orm import declarative_base, Session, with_loader_criteria
from app.core.config import settings
from app.core.tenant_context import current_org_id

if settings.DATABASE_URL.startswith("sqlite"):
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=settings.DEBUG,
        connect_args={"check_same_thread": False},
    )
else:
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=settings.DEBUG,
        pool_size=10,
        max_overflow=20,
        pool_recycle=3600,
        pool_pre_ping=True,
    )

# Фабрика сессий
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

# Базовый класс для моделей
Base = declarative_base()


def _apply_tenant_filter(orm_execute_state):
    """Глобальный tenant-isolation фильтр (S8, defense-in-depth).

    Fail-open: если контекст организации не установлен (current_org_id is None),
    фильтр не применяется — это осознанно, чтобы не ломать неаутентифицированные
    потоки (login/register/seed) и user-scoped маршруты, которые не читают
    данные по org-независимым запросам.

    Bounded scope (D6): фильтруются ТОЛЬКО Company и User. Прочие бизнес-модели
    (metric/cohort/budget/...) защищены require_company_access.
    """
    if not orm_execute_state.is_select:
        return
    if orm_execute_state.execution_options.get("skip_tenant_filter", False):
        return
    org_id = current_org_id.get()
    if org_id is None:
        return
    from app.models.company import Company
    from app.models.user import User
    orm_execute_state.statement = orm_execute_state.statement.options(
        with_loader_criteria(Company, Company.organization_id == org_id, include_aliases=True),
        with_loader_criteria(User, User.organization_id == org_id, include_aliases=True),
    )


# Слушатель вешается на СИНХРОННЫЙ Session (НЕ AsyncSession/async_sessionmaker —
# те на SQLAlchemy 2.0.36 бросают InvalidRequestError). Синхронный Session ловит
# async-сессии любого sessionmaker (включая conftest override), т.к. AsyncSession
# композирует внутри себя обычный Session.
event.listen(Session, "do_orm_execute", _apply_tenant_filter)


async def get_db() -> AsyncSession:
    """Dependency для получения сессии БД.
    
    TRANSACTION CONTRACT: This is the SINGLE commit/rollback point.
    Services MUST NOT call commit() or rollback() — use flush() for
    intermediate writes. This dependency handles all transaction lifecycle.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
