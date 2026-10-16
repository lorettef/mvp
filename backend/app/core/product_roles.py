"""Product roles derived from persisted identity; never from JWT/client claims."""

from app.core.roles import ProductRole
from app.models.company import Company
from app.models.organization import Organization
from app.models.user import User
from sqlalchemy.ext.asyncio import AsyncSession


def resolve_product_role(
    user: User, organization: Organization | None, company: Company | None = None
) -> ProductRole | None:
    if organization is None or organization.id != user.organization_id:
        return None
    if organization.organization_type not in ("fund", "startup"):
        return None
    if user.role == "admin" and organization.organization_type == "fund":
        return "fund"
    if user.role == "observer" and organization.organization_type == "fund":
        return "investor"
    if user.role == "admin" and organization.organization_type == "startup":
        # Only the existing initial-provisioning path is available while unbound.
        if user.company_id is None:
            return "startup"
    elif user.role != "company":
        return None
    if (
        company is not None
        and company.id == user.company_id
        and company.organization_id == organization.id
    ):
        return "startup"
    return None


async def load_product_context(
    db: AsyncSession, user: User, organization: Organization | None
) -> dict:
    company = None
    if user.company_id is not None and (
        user.role == "company"
        or user.role == "admin"
        and organization is not None
        and organization.organization_type == "startup"
    ):
        company = await db.get(
            Company, user.company_id, execution_options={"skip_tenant_filter": True}
        )
    return {
        "product_role": resolve_product_role(user, organization, company),
        "organization_type": organization.organization_type if organization else None,
    }
