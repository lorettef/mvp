from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.financing import Financing
from app.schemas.financing import FinancingCreate, FinancingUpdate


class FinancingService:
    """CRUD записей финансирования компании (инвестиции и кредиты/займы)."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_financing(self, company_id: UUID) -> list[Financing]:
        result = await self.db.execute(
            select(Financing)
            .where(Financing.company_id == company_id)
            .order_by(Financing.created_at, Financing.id)
        )
        return list(result.scalars().all())

    async def create_financing(
        self, company_id: UUID, data: FinancingCreate
    ) -> Financing:
        row = Financing(company_id=company_id, **data.model_dump())
        self.db.add(row)
        await self.db.flush()
        await self.db.refresh(row)
        return row

    async def update_financing(
        self, company_id: UUID, financing_id: UUID, data: FinancingUpdate
    ) -> Financing:
        row = await self._get_owned(company_id, financing_id)
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(row, key, value)
        self._validate_state(row)
        await self.db.flush()
        await self.db.refresh(row)
        return row

    async def delete_financing(self, company_id: UUID, financing_id: UUID) -> None:
        row = await self._get_owned(company_id, financing_id)
        await self.db.delete(row)
        await self.db.flush()

    async def _get_owned(self, company_id: UUID, financing_id: UUID) -> Financing:
        row = await self.db.get(Financing, financing_id)
        if not row or row.company_id != company_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Финансирование не найдено",
            )
        return row

    @staticmethod
    def _validate_state(row: Financing) -> None:
        if row.type == "investment" and (row.annual_rate or row.term_months):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="investment не может иметь annual_rate/term_months",
            )
        if row.type == "loan" and not row.annual_rate:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="loan требует annual_rate",
            )
