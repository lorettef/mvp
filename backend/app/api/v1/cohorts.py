import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.dependencies import require_company_access, ROLE_ADMIN, ROLE_COMPANY
from app.schemas.cohort import CohortUpsert, CohortResponse
from app.services.cohort_service import CohortService

router = APIRouter()


@router.put("/{company_id}/cohorts", response_model=CohortResponse)
async def upsert_cohort(
    company_id: uuid.UUID,
    data: CohortUpsert,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    if user["role"] not in (ROLE_ADMIN, ROLE_COMPANY):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав",
        )

    service = CohortService(db)
    cohort = await service.upsert_cohort(company_id, data)
    return CohortResponse.model_validate(cohort)


@router.get("/{company_id}/cohorts", response_model=list[CohortResponse])
async def list_cohorts(
    company_id: uuid.UUID,
    period: Optional[date] = None,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    service = CohortService(db)
    cohorts = await service.list_cohorts(company_id, period)
    return [CohortResponse.model_validate(c) for c in cohorts]


@router.delete("/{company_id}/cohorts/{cohort_id}")
async def delete_cohort(
    company_id: uuid.UUID,
    cohort_id: uuid.UUID,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    if user["role"] not in (ROLE_ADMIN, ROLE_COMPANY):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав",
        )

    service = CohortService(db)
    await service.delete_cohort(company_id, cohort_id)
    return {"detail": "ok"}
