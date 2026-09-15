import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.dependencies import require_company_access, ROLE_ADMIN, ROLE_COMPANY
from app.schemas.financing import (
    FinancingCreate,
    FinancingResponse,
    FinancingUpdate,
)
from app.services.financing_service import FinancingService

router = APIRouter()


def _require_write_role(user: dict) -> None:
    if user["role"] not in (ROLE_ADMIN, ROLE_COMPANY):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав",
        )


@router.get("/{company_id}/financing", response_model=list[FinancingResponse])
async def list_financing(
    company_id: uuid.UUID,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    service = FinancingService(db)
    rows = await service.list_financing(company_id)
    return [FinancingResponse.model_validate(r) for r in rows]


@router.post(
    "/{company_id}/financing",
    response_model=FinancingResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_financing(
    company_id: uuid.UUID,
    data: FinancingCreate,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    _require_write_role(user)
    service = FinancingService(db)
    row = await service.create_financing(company_id, data)
    return FinancingResponse.model_validate(row)


@router.patch(
    "/{company_id}/financing/{financing_id}",
    response_model=FinancingResponse,
)
async def update_financing(
    company_id: uuid.UUID,
    financing_id: uuid.UUID,
    data: FinancingUpdate,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    _require_write_role(user)
    service = FinancingService(db)
    row = await service.update_financing(company_id, financing_id, data)
    return FinancingResponse.model_validate(row)


@router.delete("/{company_id}/financing/{financing_id}")
async def delete_financing(
    company_id: uuid.UUID,
    financing_id: uuid.UUID,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    _require_write_role(user)
    service = FinancingService(db)
    await service.delete_financing(company_id, financing_id)
    return {"detail": "ok"}
