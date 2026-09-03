from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_user_full
from app.core import metric_catalog
from app.schemas.catalog import CatalogResponse

router = APIRouter()


@router.get("", response_model=CatalogResponse)
async def get_catalog(
    current_user: dict = Depends(get_current_user_full),
):
    """Метрический каталог: индустрии, бизнес-модели и профили метрик."""
    return CatalogResponse(
        industries=metric_catalog.list_industries(),
        business_models=metric_catalog.list_business_models(),
        profiles=metric_catalog.INDUSTRY_PROFILES,
    )
