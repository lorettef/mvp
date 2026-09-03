"""Migration chain must run on SQLite (local dev + tests target SQLite).

Guards against two regressions:
1. Postgres-only ALTERs (e.g. `op.create_foreign_key` on an existing table
   without batch mode) that raise NotImplementedError on SQLite.
2. Duplicate `create_table` calls across revisions (e.g. `hiring_plans`
   created in both 003 and 006) that fail with "table already exists".
"""
import sqlite3
from pathlib import Path

from alembic import command
from alembic.config import Config

from app.core.config import settings

BACKEND_DIR = Path(__file__).resolve().parent.parent

EXPECTED_TABLES = {
    "users",
    "subscriptions",
    "ai_cache",
    "audit_log",
    "organizations",
    "companies",
    "metrics",
    "hiring_plans",
    "financing",
    "valuations",
    "cohorts",
    "budgets",
    "tasks",
    "hiring_settings",
    "analytics_events",
    "invites",
}


def _make_config() -> Config:
    cfg = Config()
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    return cfg


def _table_names(db_path: Path) -> set[str]:
    conn = sqlite3.connect(str(db_path))
    try:
        rows = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
        return {r[0] for r in rows}
    finally:
        conn.close()


def _alembic_version(db_path: Path) -> str:
    conn = sqlite3.connect(str(db_path))
    try:
        return conn.execute("SELECT version_num FROM alembic_version").fetchone()[0]
    finally:
        conn.close()


def test_alembic_upgrade_head_on_sqlite(tmp_path, monkeypatch):
    """`alembic upgrade head` must produce the full schema on a fresh SQLite DB."""
    db_path = tmp_path / "migration.db"
    monkeypatch.setattr(settings, "DATABASE_URL", f"sqlite+aiosqlite:///{db_path}")

    command.upgrade(_make_config(), "head")

    assert _alembic_version(db_path) == "011_company_lifecycle"
    assert EXPECTED_TABLES <= _table_names(db_path)


def test_alembic_downgrade_base_on_sqlite(tmp_path, monkeypatch):
    """Full round-trip: upgrade to head then downgrade to base must both succeed."""
    db_path = tmp_path / "migration.db"
    monkeypatch.setattr(settings, "DATABASE_URL", f"sqlite+aiosqlite:///{db_path}")

    cfg = _make_config()
    command.upgrade(cfg, "head")
    command.downgrade(cfg, "base")

    # After downgrade to base, the multi-tenancy tables must be gone.
    remaining = _table_names(db_path)
    assert "organizations" not in remaining
    assert "companies" not in remaining
