from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import settings
from app.core.limiter import limiter
from app.core.database import get_db
from app.models.user import User
from app.models.organization import Organization
from app.schemas.auth import UserCreate, UserLogin, TokenResponse, UserResponse
from app.services.auth_service import AuthService
from app.services.subscription_service import SubscriptionService
from app.services.seed_service import seed_demo_account
from app.api.dependencies import get_current_user

router = APIRouter()

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(
    data: UserCreate,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Регистрация нового пользователя."""
    auth_service = AuthService(db)
    user_data = await auth_service.register(data)
    
    # Получение информации о подписке
    sub_service = SubscriptionService(db)
    sub_info = await sub_service.get_user_subscription(user_data["id"])
    
    return UserResponse(
        id=user_data["id"],
        email=user_data["email"],
        full_name=user_data["full_name"],
        company_name=user_data["company_name"],
        role=user_data["role"],
        organization_id=user_data["organization_id"],
        company_id=user_data["company_id"],
        created_at=user_data["created_at"],
        subscription_plan=sub_info["plan"],
        daily_limit=sub_info["daily_limit"],
        used_today=sub_info["used_today"],
        organization_type=user_data["organization_type"]
    )

@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(
    data: UserLogin,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Авторизация пользователя."""
    auth_service = AuthService(db)
    result = await auth_service.login(data.email, data.password)

    response.set_cookie(
        key="access_token",
        value=result["access_token"],
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        max_age=result["expires_in"],
        path="/",
    )

    return TokenResponse(token_type=result["token_type"], expires_in=result["expires_in"])

@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить информацию о текущем пользователе."""
    result = await db.execute(
        select(User).where(User.id == current_user["user_id"])
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )
    
    sub_service = SubscriptionService(db)
    sub_info = await sub_service.get_user_subscription(user.id)
    
    organization = None
    if user.organization_id:
        organization = await db.get(Organization, user.organization_id)
    
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        company_name=user.company_name,
        role=user.role,
        organization_id=user.organization_id,
        company_id=user.company_id,
        created_at=user.created_at,
        subscription_plan=sub_info["plan"],
        daily_limit=sub_info["daily_limit"],
        used_today=sub_info["used_today"],
        organization_type=organization.organization_type if organization else None
    )

@router.post("/logout")
async def logout(response: Response):
    """Выход из системы — удаление httpOnly cookie."""
    response.delete_cookie(key="access_token", path="/")
    return {"detail": "ok"}

@router.post("/seed", response_model=dict, status_code=status.HTTP_201_CREATED)
async def seed_demo(
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Create demo account and auto-login (DEMO_MODE only)."""
    if not settings.DEMO_MODE:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Demo mode disabled")
    if settings.DEMO_ACCOUNT_PASSWORD is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Demo account not configured")
    result = await seed_demo_account(db)
    # Auto-login: set JWT cookie so frontend doesn't need the password
    from app.core.security import create_access_token
    token = create_access_token({"sub": result["user_id"]})
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        max_age=60 * 24 * 7,
        path="/",
    )
    return {"email": result["email"]}


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    response: Response,
    current_user: dict = Depends(get_current_user),
):
    """Sliding session (D5): issue a fresh token for the authenticated user."""
    from app.core.security import create_access_token
    token = create_access_token({"sub": str(current_user["user_id"])})
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    return TokenResponse(
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )