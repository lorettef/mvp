from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.services.subscription_service import SubscriptionService
from app.api.dependencies import get_current_user

router = APIRouter()

@router.get("/status")
async def get_subscription_status(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить статус подписки."""
    service = SubscriptionService(db)
    return await service.get_user_subscription(current_user["user_id"])

# УДАЛЁН self-service /update endpoint (CRIT #2).
# Смена тарифа должна происходить через webhook платёжного шлюза.
# Для ручного обновления (админ) — использовать admin-эндпоинт
# с проверкой роли администратора.
