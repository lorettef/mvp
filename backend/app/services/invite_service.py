import secrets
from datetime import timedelta
from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status

from app.models.invite import Invite
from app.models.organization import Organization
from app.core.time import utcnow

INVITE_TTL_DAYS = 7
INVITE_INVALID_DETAIL = "Приглашение недействительно или истекло"


class InviteService:
    """Сервис приглашений: создание, валидация и публичная информация по токену."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_invite(self, organization_id: UUID, email: Optional[str]) -> dict:
        invite = Invite(
            token=secrets.token_urlsafe(32),
            organization_id=organization_id,
            email=email,
            expires_at=utcnow() + timedelta(days=INVITE_TTL_DAYS),
        )
        self.db.add(invite)
        await self.db.flush()
        return {
            "token": invite.token,
            "expires_at": invite.expires_at,
            "email": invite.email,
        }

    async def get_valid_invite(self, token: str) -> Invite:
        """Возвращает действующее приглашение или 404.

        Намеренно один общий ответ для всех причин недействительности
        (не найден / использован / истёк), чтобы не раскрывать, какая
        именно проверка провалилась.
        """
        result = await self.db.execute(
            select(Invite).where(Invite.token == token)
        )
        invite = result.scalar_one_or_none()

        if (
            not invite
            or invite.used_at is not None
            or invite.expires_at <= utcnow()
        ):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=INVITE_INVALID_DETAIL,
            )
        return invite

    async def get_invite_info(self, token: str) -> dict:
        invite = await self.get_valid_invite(token)
        org = await self.db.get(Organization, invite.organization_id)
        if not org:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=INVITE_INVALID_DETAIL,
            )
        return {
            "organization_name": org.name,
            "email": invite.email,
        }
