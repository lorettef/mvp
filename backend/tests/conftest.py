import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.main import app
from app.core.database import Base, get_db
from app.core.security import create_access_token
from app.models.organization import Organization
from app.models.company import Company
from app.models.user import User

TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"


@pytest_asyncio.fixture(scope="function")
async def db_session():
    """Create test database tables, yield session, then drop all."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession):
    """HTTP test client with test DB override."""

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def seeded_organization(db_session: AsyncSession) -> Organization:
    org = Organization(name="Test Accelerator")
    db_session.add(org)
    await db_session.flush()
    return org


@pytest_asyncio.fixture
async def seeded_company(
    db_session: AsyncSession, seeded_organization: Organization
) -> Company:
    company = Company(
        organization_id=seeded_organization.id,
        name="Test Startup",
        industry="SaaS",
        geography="RU",
    )
    db_session.add(company)
    await db_session.flush()
    return company


async def make_user(
    db: AsyncSession,
    email: str,
    role: str,
    organization_id=None,
    company_id=None,
) -> User:
    user = User(
        email=email,
        password_hash="unused-in-tests",
        full_name="Test User",
        role=role,
        organization_id=organization_id,
        company_id=company_id,
    )
    db.add(user)
    await db.flush()
    return user


@pytest_asyncio.fixture
async def seeded_admin(
    db_session: AsyncSession, seeded_organization: Organization, seeded_company: Company
) -> User:
    return await make_user(
        db_session, "admin@test.ru", "admin", seeded_organization.id, seeded_company.id
    )


@pytest_asyncio.fixture
async def seeded_company_user(
    db_session: AsyncSession, seeded_organization: Organization, seeded_company: Company
) -> User:
    return await make_user(
        db_session, "company@test.ru", "company", seeded_organization.id, seeded_company.id
    )


@pytest_asyncio.fixture
async def seeded_observer(
    db_session: AsyncSession, seeded_organization: Organization, seeded_company: Company
) -> User:
    return await make_user(
        db_session, "observer@test.ru", "observer", seeded_organization.id, seeded_company.id
    )


def auth_headers(user: User) -> dict:
    token = create_access_token({"sub": str(user.id)})
    return {"Authorization": f"Bearer {token}"}
