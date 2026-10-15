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

    assert _alembic_version(db_path) == "017_budget_cogs"
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


def test_cogs_upgrade_keeps_legacy_unknown_and_downgrade_preserves_row(
    tmp_path, monkeypatch
):
    path = tmp_path / "legacy-cogs.db"
    monkeypatch.setattr(settings, "DATABASE_URL", f"sqlite+aiosqlite:///{path}")
    cfg = _make_config()
    command.upgrade(cfg, "016_hiring_roles")
    with sqlite3.connect(path) as db:
        db.execute(
            "INSERT INTO budgets (id, company_id, period, type, marketing, development, fot, gna) VALUES ('b', 'c', '2026-10-01', 'fact', 1, 2, 3, 4)"
        )
    command.upgrade(cfg, "head")
    with sqlite3.connect(path) as db:
        assert db.execute("SELECT cogs, gna FROM budgets WHERE id='b'").fetchone() == (
            None,
            4,
        )
        assert any(
            r[1] == "cogs" and r[2] == "NUMERIC(14, 2)" and r[4] is None
            for r in db.execute("PRAGMA table_info(budgets)")
        )
    command.downgrade(cfg, "016_hiring_roles")
    with sqlite3.connect(path) as db:
        assert db.execute("SELECT gna FROM budgets WHERE id='b'").fetchone() == (4,)
        assert all(r[1] != "cogs" for r in db.execute("PRAGMA table_info(budgets)"))

    command.upgrade(cfg, "head")
    with sqlite3.connect(path) as db:
        assert db.execute("SELECT cogs, gna FROM budgets WHERE id='b'").fetchone() == (
            None,
            4,
        )
    assert _alembic_version(path) == "017_budget_cogs"


def test_cogs_migration_postgres_sql(monkeypatch):
    from io import StringIO

    monkeypatch.setattr(
        settings, "DATABASE_URL", "postgresql+asyncpg://user:pass@localhost/test"
    )
    cfg = _make_config()
    cfg.output_buffer = StringIO()
    command.upgrade(cfg, "016_hiring_roles:017_budget_cogs", sql=True)
    sql = cfg.output_buffer.getvalue()
    assert "ADD COLUMN cogs NUMERIC(14, 2)" in sql
    assert "DEFAULT" not in sql and "UPDATE budgets" not in sql
