from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.company import Company
from app.schemas.company import CompanyCreate, CompanyUpdate
from app.core.roles import ROLE_ADMIN
from app.core.time import utcnow


class CompanyService:
    """Сервис управления компаниями."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_company(
        self, organization_id: UUID, data: CompanyCreate
    ) -> Company:
        """Создание компании в организации."""
        existing = await self.db.execute(
            select(Company).where(
                Company.organization_id == organization_id,
                Company.name == data.name,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Компания с таким названием уже существует"
            )

        company = Company(
            organization_id=organization_id,
            name=data.name,
            industry=data.industry,
            geography=data.geography,
            gross_margin=data.gross_margin if data.gross_margin is not None else 0.75,
            business_model=data.business_model,
            selected_metrics=data.selected_metrics,
        )
        self.db.add(company)
        await self.db.flush()
        return company

    async def list_companies(self, user: dict, archived: bool = False) -> list[Company]:
        """Список компаний, доступных пользователю.

        `archived=False` возвращает активные компании (archived_at IS NULL),
        `archived=True` — только архивные (archived_at IS NOT NULL).
        """
        archived_filter = (
            Company.archived_at.is_not(None)
            if archived
            else Company.archived_at.is_(None)
        )

        if user["role"] == ROLE_ADMIN:
            result = await self.db.execute(
                select(Company)
                .where(
                    Company.organization_id == user["organization_id"],
                    archived_filter,
                )
                .order_by(Company.name)
            )
            return list(result.scalars().all())

        if user["company_id"]:
            result = await self.db.execute(
                select(Company).where(
                    Company.id == user["company_id"],
                    archived_filter,
                )
            )
            return list(result.scalars().all())

        return []

    async def get_company(self, company_id: UUID) -> Company:
        """Получение компании по идентификатору."""
        company = await self.db.get(Company, company_id)
        if not company:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Компания не найдена"
            )
        return company

    async def update_company(self, company: Company, data: CompanyUpdate) -> Company:
        """Обновление данных компании."""
        for field in ("name", "industry", "geography", "gross_margin", "business_model", "selected_metrics"):
            value = getattr(data, field)
            if value is not None:
                setattr(company, field, value)

        await self.db.flush()
        return company

    async def archive_company(self, company: Company) -> Company:
        """Архивация компании (архивные скрыты из активного списка)."""
        company.archived_at = utcnow()
        await self.db.flush()
        return company

    async def restore_company(self, company: Company) -> Company:
        """Восстановление компании из архива."""
        company.archived_at = None
        await self.db.flush()
        return company

    async def delete_company(self, company: Company) -> None:
        """Удаление компании."""
        await self.db.delete(company)
        await self.db.flush()

    async def count_companies(self, organization_id: UUID) -> int:
        """Количество компаний в организации."""
        result = await self.db.execute(
            select(func.count(Company.id)).where(
                Company.organization_id == organization_id
            )
        )
        return result.scalar() or 0
