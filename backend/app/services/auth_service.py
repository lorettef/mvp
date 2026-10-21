from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from app.models.user import User
from app.models.subscription import Subscription
from app.models.organization import Organization
from app.models.company import Company
from app.schemas.auth import UserCreate
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    dummy_password_hash,
)
from app.core.config import settings
from app.core.time import utcnow
from app.services.invite_service import InviteService
from app.services.company_service import CompanyService
from app.services.subscription_service import SubscriptionService


class AuthService:
    """Сервис аутентификации."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def register(self, data: UserCreate) -> dict:
        """Регистрация нового пользователя.

        Три пути входа:
        - приглашение (invite_token): пользователь присоединяется к существующей
          организации с ролью company и получает свою компанию;
        - самостоятельный стартап (account_type="startup"): создаётся организация
          типа startup, пользователь — admin и владелец своей компании;
        - фонд (по умолчанию): организация типа fund, пользователь — admin.
        """
        invite = None
        if data.invite_token:
            # PostgreSQL keeps this row lock until get_db commits the complete
            # registration transaction, serializing concurrent consumption.
            invite = await InviteService(self.db).get_valid_invite(
                data.invite_token, for_update=True
            )
            if invite.email and invite.email.strip().lower() != data.email:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Email не соответствует приглашению",
                )
            # Validate organization capacity before creating any dependent rows.
            plan_id = await SubscriptionService(self.db).get_org_plan_id(
                invite.organization_id
            )
            await CompanyService(self.db).enforce_company_limit(
                invite.organization_id, plan_id
            )

        # Friendly pre-check; the DB unique constraint remains authoritative.
        existing = await self.db.execute(
            select(User).where(func.lower(User.email) == data.email)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Аккаунт с таким email уже существует",
            )

        # Создание пользователя
        user = User(
            email=data.email,
            password_hash=hash_password(data.password),
            full_name=data.full_name,
            company_name=data.company_name,
        )
        try:
            async with self.db.begin_nested():
                self.db.add(user)
                await self.db.flush()
        except IntegrityError as exc:
            if self._is_duplicate_email(exc):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Аккаунт с таким email уже существует",
                ) from exc
            raise

        # Создание бесплатной подписки
        subscription = Subscription(user_id=user.id, plan="starter")
        self.db.add(subscription)
        await self.db.flush()

        if invite is not None:

            user.role = "company"
            user.organization_id = invite.organization_id

            company = Company(
                organization_id=invite.organization_id,
                name=data.company_name,
                industry=data.industry,
                geography=data.geography,
            )
            self.db.add(company)
            await self.db.flush()
            user.company_id = company.id

            invite.used_at = utcnow()
        elif data.account_type == "startup":
            organization = Organization(
                name=data.company_name or data.full_name, organization_type="startup"
            )
            self.db.add(organization)
            await self.db.flush()

            user.role = "admin"
            user.organization_id = organization.id

            company = Company(
                organization_id=organization.id,
                name=data.company_name,
                industry=data.industry,
                geography=data.geography,
            )
            self.db.add(company)
            await self.db.flush()
            user.company_id = company.id
        else:
            # Создание организации фонда и назначение владельца.
            organization = Organization(
                name=data.company_name or data.full_name or "Мой акселератор",
                organization_type="fund",
            )
            self.db.add(organization)
            await self.db.flush()

            user.role = "admin"
            user.organization_id = organization.id
            # Fund is the tenant owner, not a portfolio Company. Startups are
            # added later through onboarding or an invite.
            user.company_id = None

        await self.db.flush()

        organization = None
        if user.organization_id:
            organization = await self.db.get(Organization, user.organization_id)

        return {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "company_name": user.company_name,
            "role": user.role,
            "organization_id": (
                str(user.organization_id) if user.organization_id else None
            ),
            "company_id": str(user.company_id) if user.company_id else None,
            "organization_type": (
                organization.organization_type if organization else None
            ),
            "created_at": user.created_at.isoformat(),
        }

    @staticmethod
    def _is_duplicate_email(exc: IntegrityError) -> bool:
        """Recognize only the users.email constraint, never all integrity errors."""
        original = exc.orig
        constraint = getattr(getattr(original, "diag", None), "constraint_name", None)
        if constraint in {"users_email_key", "ix_users_email"}:
            return True
        return "unique constraint failed: users.email" in str(original).lower()

    async def login(self, email: str, password: str) -> dict:
        """Авторизация пользователя."""
        normalized_email = email.strip().lower()
        result = await self.db.execute(
            select(User).where(func.lower(User.email) == normalized_email)
        )
        user = result.scalar_one_or_none()

        if not user:
            # Timing-safe: прогоняем пароль через bcrypt на валидном dummy-хеше,
            # чтобы несуществующий email отвечал за то же время, что и неверный
            # пароль существующего пользователя (защита от user-enumeration).
            verify_password(password, dummy_password_hash())
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Неверный email или пароль",
            )

        if not verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Неверный email или пароль",
            )

        user.last_login = utcnow()
        await self.db.flush()

        access_token = create_access_token({"sub": str(user.id)})

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        }
