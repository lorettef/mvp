"""Provision the configured demo tenant using the application seed service.

Run from ``backend/`` with the normal application environment loaded:

    python scripts/seed_demo.py
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings  # noqa: E402
from app.core.database import AsyncSessionLocal  # noqa: E402
from app.services.seed_service import seed_demo_account  # noqa: E402


async def main() -> None:
    if not settings.DEMO_MODE:
        raise SystemExit("DEMO_MODE must be true")
    if settings.DEMO_ACCOUNT_PASSWORD is None:
        raise SystemExit("DEMO_ACCOUNT_PASSWORD must be configured")

    async with AsyncSessionLocal() as session:
        try:
            result = await seed_demo_account(session)
            await session.commit()
        except Exception:
            await session.rollback()
            raise

    print(f"Demo account: {result['email']}")
    print("Password: value of DEMO_ACCOUNT_PASSWORD (not printed)")
    print(f"Organization: {result['organization_id']}")
    print(f"Companies: {result['company_count']}")


if __name__ == "__main__":
    asyncio.run(main())
