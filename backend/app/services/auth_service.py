from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status
from app.models.user import User
from app.models.subscription import Subscription
from app.schemas.auth import UserCreate
from app.core.security import hash_password, verify_password, create_access_token

class AuthService:
    """Сервис аутентификации."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def register(self, data: UserCreate) -> dict:
        """Регистрация нового пользователя."""
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
            plan="free",
            daily_limit=1
        )
        self.db.add(subscription)
        await self.db.flush()
        
        return {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "company_name": user.company_name,
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

        user.last_login = datetime.now(timezone.utc).replace(tzinfo=None)
        await self.db.flush()

        access_token = create_access_token({"sub": str(user.id)})

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": 60 * 24 * 7
        }