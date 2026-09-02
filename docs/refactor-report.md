# Security-First Backend Refactor — Refactor Report

## Summary

This refactor hardens the Kolya v2 backend against ten real security and correctness
weaknesses identified during a security audit, replacing application-layer
shortcuts with defense-in-depth controls and proving each fix with regression
tests. The work covers: secure session cookies (`Secure`/`HttpOnly`/`SameSite`),
removal of GET-with-side-effect endpoints (new `POST /hiring/generate`),
per-user AI-cache scoping with newest-row dedupe, org-scoped admin broadcast,
observer write-forbiddance (`403`), JWT `jti` claims with sliding-session
refresh (`POST /auth/refresh`), a global tenant filter (`do_orm_execute` +
`with_loader_criteria`, `ContextVar`, `skip_tenant_filter` escape hatch),
removal of the demo-password seed path, dual-channel (bearer + cookie)
token resolution, plus dedup/layering/performance/serialization cleanups across
the hiring, valuation, PnL, unit-economics, dashboard, weekly-report, and
recalculate services. All production changes are locked by 168 passing tests
(up from ~130 at plan start), zero new migrations, and clean audit greps.

## Task → Test Mapping

| Security task | Plan task | Test file(s) |
|---|---|---|
| S1 — Secure session cookie | T1.1 | `tests/test_auth_security.py` (login sets Secure/HttpOnly/SameSite cookie; seed cookie also secure) |
| S2 — GET-with-write on /hiring | T1.5 | `tests/test_hiring.py::test_get_hiring_does_not_persist`, `tests/test_valuation.py::test_get_valuation_does_not_write_hiring_rows` (new `POST /hiring/generate`) |
| S3 — AI-cache tenant leak | T1.4 | `tests/test_ai_cache_isolation.py` (per-user scoping, newest-row dedupe) |
| S4 — Admin broadcast scoping | T1.3 | `tests/test_admin.py` (org-scoped recipients) |
| S5 — Observer write forbidden | T1.2 | `tests/test_recalculate.py::test_recalculate_observer_forbidden_403` |
| S6 — 7-day token hardening | T1.1 | `tests/test_auth_security.py` (jti claim + `POST /auth/refresh` sliding session) |
| S7 — CSRF GET surface | T1.5 | read-only GET /hiring & /valuation (same tests as S2) |
| S8 — No defense-in-depth | T1.7 | `tests/test_tenant_filter.py` (global Company/User filter via `do_orm_execute` + `with_loader_criteria`, `ContextVar`, `skip_tenant_filter` escape hatch) |
| S9 — Demo password seed | T1.1 | `tests/test_auth_security.py::test_seed_without_demo_password_403` |
| S10 — Dual-channel token | T1.6 | `tests/test_dependencies.py` (`get_current_org` + dual-channel doc) |
| D1/D7/D8/D9 — Dedup, layering, performance, serialization | T2.x / T3.x / T4.x | `tests/test_common_helpers.py`, `tests/test_pnl.py`, `tests/test_unit_economics.py`, `tests/test_hiring.py`, `tests/test_valuation.py`, `tests/test_layering.py`, `tests/test_serialization.py`, `tests/test_dashboard.py`, `tests/test_weekly_report.py`, `tests/test_recalculate.py` |
| Cross-tenant regression matrix | T5.1 | `tests/test_tenancy_isolation.py` |

## Residual Risks / Follow-Ups

1. **Token TTL still 7 days** — `ACCESS_TOKEN_EXPIRE_MINUTES` is unchanged. Reducing it
   to 12h requires frontend adoption of `POST /auth/refresh` and explicit sign-off.
2. **PostgreSQL Row-Level Security (RLS) not implemented** — documented as future
   hardening. Isolation is currently enforced at the application layer
   (`require_company_access` + the global tenant filter).
3. **Frontend `POST /hiring/generate` adoption** — GET /hiring is now read-only;
   the frontend must call the new POST endpoint to persist plans (follow-up).
4. **AI cache still keyed per-user (not org-level)** — org-level cache hardening is
   future work; the current fix prevents cross-user leakage and returns the newest row.

## Verification

- Full suite: **168 passed** (baseline at plan start: ~130) — `pytest -q`, 157.21s, zero failures.
- Migrations: `tests/test_migrations.py` — **2 passed** (no new Alembic migration added).
- Org-scope: `tests/test_admin.py` + `tests/test_tenancy_isolation.py` — **8 passed**.
- Audit greps (all clean):
  - `secure=False` → no matches
  - `datetime.now(timezone.utc).replace` → only inside `core/time.py` `utcnow()` (expected)
  - `from app.api` in `app/services` → no matches
  - `_to_response` in `app/api` → no matches
  - `scalar_one_or_none` in `ai_service.py` → zero occurrences (cache path uses safe `scalars().first()`)
