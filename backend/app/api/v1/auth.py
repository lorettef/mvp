import logging
import secrets

from app.api.dependencies import get_current_user
from app.core.config import settings
from app.core.auth_cookie import set_auth_cookie
from app.core.database import get_db
from app.core.limiter import limiter
from app.core.product_roles import load_product_context
from app.models.organization import Organization
from app.models.user import User
from app.schemas.auth import TokenResponse, UserCreate, UserLogin, UserResponse
from app.services.auth_service import AuthService
from app.services.seed_service import seed_demo_account
from app.services.subscription_service import SubscriptionService
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post(
    "/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED
)
@limiter.limit("10/minute")
async def register(
    data: UserCreate,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Регистрация нового пользователя."""
    auth_service = AuthService(db)
    try:
        user_data = await auth_service.register(data)
    except HTTPException as exc:
        category = "invalid_invite" if data.invite_token else "duplicate"
        logger.info(
            "Registration rejected: category=%s status=%s", category, exc.status_code
        )
        raise
    except Exception:
        logger.exception("Registration failed: category=internal")
        raise

    # Получение информации о подписке
    sub_service = SubscriptionService(db)
    sub_info = await sub_service.get_user_subscription(user_data["id"])

    from app.core.security import create_access_token

    set_auth_cookie(response, create_access_token({"sub": str(user_data["id"])}))
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
        organization_type=user_data["organization_type"],
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

    set_auth_cookie(response, result["access_token"], result["expires_in"])

    return TokenResponse(
        token_type=result["token_type"], expires_in=result["expires_in"]
    )


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Получить информацию о текущем пользователе."""
    result = await db.execute(select(User).where(User.id == current_user["user_id"]))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден"
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
        product_role=(await load_product_context(db, user, organization))[
            "product_role"
        ],
        organization_id=user.organization_id,
        company_id=user.company_id,
        created_at=user.created_at,
        subscription_plan=sub_info["plan"],
        daily_limit=sub_info["daily_limit"],
        used_today=sub_info["used_today"],
        organization_type=organization.organization_type if organization else None,
    )


@router.post("/logout")
async def logout(response: Response):
    """Выход из системы — удаление httpOnly cookie."""
    response.delete_cookie(key="access_token", path="/")
    return {"detail": "ok"}


@router.post("/seed", response_model=dict, status_code=status.HTTP_201_CREATED)
@limiter.limit("3/minute")
async def seed_demo(
    request: Request,
    response: Response,
    demo_seed_token: str | None = Header(None, alias="X-Demo-Seed-Token"),
    db: AsyncSession = Depends(get_db),
):
    """Provision/reset the demo tenant and auto-login the demo user.

    This bootstrap route intentionally exists before the demo user can
    authenticate, so possession of the environment-only demo password is the
    pilot authorization boundary in addition to DEMO_MODE.
    """
    if not settings.DEMO_MODE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Demo mode disabled"
        )
    if settings.DEMO_ACCOUNT_PASSWORD is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Demo account not configured"
        )
    configured_token = settings.DEMO_ACCOUNT_PASSWORD.get_secret_value()
    if (
        not configured_token
        or not demo_seed_token
        or not secrets.compare_digest(demo_seed_token, configured_token)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Invalid demo seed token"
        )
    try:
        result = await seed_demo_account(db)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(exc)
        ) from exc
    # Auto-login: set JWT cookie so frontend doesn't need the password
    from app.core.security import create_access_token

    token = create_access_token({"sub": result["user_id"]})
    set_auth_cookie(response, token)
    return result


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    response: Response,
    current_user: dict = Depends(get_current_user),
):
    """Sliding session (D5): issue a fresh token for the authenticated user."""
    from app.core.security import create_access_token

    token = create_access_token({"sub": str(current_user["user_id"])})
    set_auth_cookie(response, token)
    return TokenResponse(
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
