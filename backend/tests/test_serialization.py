import uuid
from datetime import datetime

from app.models.company import Company
from app.schemas.company import CompanyResponse


def test_company_response_serialized_from_orm():
    """model_validate(orm) must equal explicit-kwargs construction (old mapper semantics)."""
    company = Company(
        id=uuid.uuid4(),
        organization_id=uuid.uuid4(),
        name="Test Company",
        industry="SaaS",
        geography="Global",
        gross_margin=0.75,
        created_at=datetime(2024, 1, 15, 10, 30, 0),
    )

    from_orm = CompanyResponse.model_validate(company)
    explicit = CompanyResponse(
        id=company.id,
        organization_id=company.organization_id,
        name=company.name,
        industry=company.industry,
        geography=company.geography,
        gross_margin=company.gross_margin,
        created_at=company.created_at,
    )

    assert from_orm.model_dump(mode="json") == explicit.model_dump(mode="json")
