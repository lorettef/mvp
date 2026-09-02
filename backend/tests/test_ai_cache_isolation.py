"""Security refactor tests: AI cache reads must be scoped by user_id.

Regression coverage for the cross-tenant cache leak (S3): `_get_cached` used
to look rows up by metrics_hash alone, so a cache entry written for user A
could be served to any other user with identical metrics. It also used
`scalar_one_or_none()`, which raised MultipleResultsFound when duplicate
rows existed for the same hash.
"""

import json
from datetime import datetime, timedelta, timezone

from .conftest import make_user
from app.models.ai_cache import AICache
from app.schemas.recommendations import RecommendationResponse
from app.services.ai_service import AIService


def _future_expiry() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=1)


def _row(user_id, metrics_hash, summary, created_at, expires_at):
    return AICache(
        user_id=user_id,
        metrics_hash=metrics_hash,
        response=json.dumps(
            RecommendationResponse(summary=summary, recommendations=[]).model_dump()
        ),
        created_at=created_at,
        expires_at=expires_at,
    )


async def test_ai_cache_not_shared_across_users(db_session):
    """A cache entry for user A must not be readable by user B (S3 leak)."""
    user_a = await make_user(db_session, "cache-a@test.ru", "admin")
    user_b = await make_user(db_session, "cache-b@test.ru", "admin")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    db_session.add(
        _row(user_a.id, "H", "only-for-A", now - timedelta(minutes=5), _future_expiry())
    )
    await db_session.flush()

    service = AIService(db_session)

    # Cross-user read: must be None — the leak returns user A's row here.
    leaked = await service._get_cached("H", str(user_b.id))
    assert leaked is None

    # Owner read: must return the row.
    own = await service._get_cached("H", str(user_a.id))
    assert own is not None
    assert own.summary == "only-for-A"


async def test_get_cached_no_multiple_results_error(db_session):
    """Duplicate rows for the same (hash, user) must not raise; newest wins."""
    user = await make_user(db_session, "cache-dup@test.ru", "admin")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    db_session.add_all(
        [
            _row(
                user.id,
                "H",
                "old",
                now - timedelta(hours=1),
                _future_expiry(),
            ),
            _row(
                user.id,
                "H",
                "new",
                now,
                _future_expiry(),
            ),
        ]
    )
    await db_session.flush()

    cached = await AIService(db_session)._get_cached("H", str(user.id))
    assert cached is not None
    assert cached.summary == "new"


async def test_get_cached_ignores_expired_rows(db_session):
    """TTL (expires_at) filter must still work after the fix."""
    user = await make_user(db_session, "cache-exp@test.ru", "admin")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    db_session.add(
        _row(
            user.id,
            "H",
            "expired",
            now - timedelta(hours=2),
            now - timedelta(hours=1),
        )
    )
    await db_session.flush()

    cached = await AIService(db_session)._get_cached("H", str(user.id))
    assert cached is None
