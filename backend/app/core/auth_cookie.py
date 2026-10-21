from fastapi import Response

from app.core.config import settings


def set_auth_cookie(response: Response, token: str, max_age: int | None = None) -> None:
    """Set the single canonical browser-session cookie contract."""
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        max_age=max_age or settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
