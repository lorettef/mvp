import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.dependencies import require_company_access, ROLE_ADMIN, ROLE_COMPANY
from app.schemas.budget import BudgetUpsert, BudgetResponse
from app.services.budget_service import BudgetService

router = APIRouter()


@router.put("/{company_id}/budgets", response_model=BudgetResponse)
async def upsert_budget(
    company_id: uuid.UUID,
    data: BudgetUpsert,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    if user["role"] not in (ROLE_ADMIN, ROLE_COMPANY):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав",
        )

    service = BudgetService(db)
    budget = await service.upsert_budget(company_id, data)
    return BudgetResponse.model_validate(budget)


@router.get("/{company_id}/budgets", response_model=list[BudgetResponse])
async def list_budgets(
    company_id: uuid.UUID,
    period: Optional[date] = None,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    service = BudgetService(db)
    budgets = await service.list_budgets(company_id, period)
    return [BudgetResponse.model_validate(b) for b in budgets]
