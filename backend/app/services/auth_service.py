from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status
from app.models.user import User
from app.models.subscription import Subscription
from app.models.organization import Organization
from app.models.company import Company
from app.schemas.auth import UserCreate
from app.core.security import hash_password, verify_password, create_access_token
from app.core.time import utcnow
from app.services.invite_service import InviteService

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
        # Проверка на существующего пользователя
        existing = await self.db.execute(
            select(User).where(User.email == data.email)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Пользователь с таким email уже существует"
            )
        
        # Создание пользователя
        user = User(
            email=data.email,
            password_hash=hash_password(data.password),
            full_name=data.full_name,
            company_name=data.company_name
        )
        self.db.add(user)
        await self.db.flush()
        
        # Создание бесплатной подписки
        subscription = Subscription(
            user_id=user.id,
            plan="starter"
        )
        self.db.add(subscription)
        await self.db.flush()
        
        if data.invite_token:
            invite_service = InviteService(self.db)
            invite = await invite_service.get_valid_invite(data.invite_token)

            user.role = "company"
            user.organization_id = invite.organization_id

            company = Company(
                organization_id=invite.organization_id,
                name=data.company_name,
                industry=data.industry,
                geography=data.geography
            )
            self.db.add(company)
            await self.db.flush()
            user.company_id = company.id

            invite.used_at = utcnow()
        elif data.account_type == "startup":
            organization = Organization(
                name=data.company_name or data.full_name,
                organization_type="startup"
            )
            self.db.add(organization)
            await self.db.flush()

            user.role = "admin"
            user.organization_id = organization.id

            company = Company(
                organization_id=organization.id,
                name=data.company_name,
                industry=data.industry,
                geography=data.geography
            )
            self.db.add(company)
            await self.db.flush()
            user.company_id = company.id
        else:
            # Создание организации (акселератора) и назначение владельца
            organization = Organization(
                name=data.company_name or data.full_name or "Мой акселератор",
                organization_type="fund"
            )
            self.db.add(organization)
            await self.db.flush()
            
            user.role = "admin"
            user.organization_id = organization.id
            
            # Создание компании, если указано название компании
            if data.company_name:
                company = Company(
                    organization_id=organization.id,
                    name=data.company_name,
                    industry=data.industry,
                    geography=data.geography
                )
                self.db.add(company)
                await self.db.flush()
                user.company_id = company.id
        
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
            "organization_id": str(user.organization_id) if user.organization_id else None,
            "company_id": str(user.company_id) if user.company_id else None,
            "organization_type": organization.organization_type if organization else None,
            "created_at": user.created_at.isoformat()
        }
    
    async def login(self, email: str, password: str) -> dict:
        """Авторизация пользователя."""
        result = await self.db.execute(
            select(User).where(User.email == email)
        )
        user = result.scalar_one_or_none()

        if not user:
            verify_password(password, "$2b$12$dummy_hash_for_timing_safety_xxxx")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Неверный email или пароль"
            )

        if not verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Неверный email или пароль"
            )

        user.last_login = utcnow()
        await self.db.flush()

        access_token = create_access_token({"sub": str(user.id)})

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": 60 * 24 * 7
        }