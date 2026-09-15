from datetime import date

import pytest
from sqlalchemy import func, select

from .conftest import auth_headers
from app.models.hiring_plan_row import HiringPlanRow
from app.models.metric import Metric
from app.services.hiring_service import HiringService


async def _count_rows(db) -> int:
    result = await db.execute(select(func.count()).select_from(HiringPlanRow))
    return result.scalar_one()


async def _seed_metric(
    db, company_id, revenue=100000, new_units=100, active_units=500, type_="plan"
):
    db.add(
        Metric(
            company_id=company_id,
            period=date(2026, 1, 1),
            type=type_,
            revenue=revenue,
            new_units=new_units,
            active_units=active_units,
            cac=1000,
            ltv=5000,
            churn=0.03,
        )
    )
    await db.flush()


async def test_get_hiring_plan_role_based_12_months(
    client, seeded_company, seeded_admin, db_session
):
    await _seed_metric(db_session, seeded_company.id, revenue=2000000, new_units=1000, active_units=5000)

    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/hiring",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()

    assert len(body["months"]) == 12
    assert body["final_headcount"] == body["months"][-1]["total_required"]

    m1 = body["months"][0]
    roles = {r["role_key"]: r for r in m1["roles"]}
    # Драйверы (с ростом ×1.05): new_units=1050 → Sales Manager ceil(1050/50)=21; active=5250 → Support ceil(5250/200)=27
    assert roles["sales_manager"]["required_headcount"] == 21
    assert roles["support"]["required_headcount"] == 27
    # Инженеры: revenue=2.1M → max(2, ceil(2.1M/500k))=5, backend=round(5*0.4)=2
    assert roles["backend"]["required_headcount"] == 2
    assert roles["management"]["required_headcount"] == 1


async def test_hiring_plan_no_metrics_empty(client, seeded_company, seeded_admin):
    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/hiring",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["months"] == []
    assert body["final_headcount"] == 0


async def test_hiring_plan_uses_fact_when_no_plan(
    client, seeded_company, seeded_admin, db_session
):
    await _seed_metric(db_session, seeded_company.id, revenue=80000, type_="fact")

    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/hiring",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    assert len(res.json()["months"]) == 12


async def test_hiring_prefers_plan_over_fact(db_session, seeded_company):
    await _seed_metric(db_session, seeded_company.id, revenue=100000, new_units=100, type_="plan")
    await _seed_metric(db_session, seeded_company.id, revenue=50000, new_units=10, type_="fact")

    plan = await HiringService(db_session).build_plan(seeded_company.id)
    # План (new_units=100) даёт больше Sales Manager, чем факт (new_units=10).
    m1_roles = {r.role_key: r for r in plan.months[0].roles}
    assert m1_roles["sales_manager"].required_headcount == 3  # ceil(100*1.05/50)


async def test_hiring_settings_defaults(client, seeded_company, seeded_admin):
    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/hiring/settings",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["ndfl_rate"] == pytest.approx(0.13)
    assert body["insurance_rate"] == pytest.approx(0.30)
    assert body["injury_rate"] == pytest.approx(0.002)
    assert body["total_rate"] == pytest.approx(0.432)
    assert body["employer_rate"] == pytest.approx(0.302)


async def test_hiring_team_upsert(client, seeded_company, seeded_admin):
    res = await client.put(
        f"/api/v1/companies/{seeded_company.id}/hiring/team",
        json={"role_key": "backend", "headcount": 3, "salary": 200000},
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    assert res.json()["headcount"] == 3
    assert res.json()["salary"] == 200000

    lst = await client.get(
        f"/api/v1/companies/{seeded_company.id}/hiring/team",
        headers=auth_headers(seeded_admin),
    )
    assert any(t["role_key"] == "backend" for t in lst.json())


async def test_hiring_approve_affects_plan(
    client, seeded_company, seeded_admin, db_session
):
    await _seed_metric(db_session, seeded_company.id, revenue=100000, new_units=100)

    plan = await client.get(
        f"/api/v1/companies/{seeded_company.id}/hiring",
        headers=auth_headers(seeded_admin),
    )
    period = plan.json()["months"][0]["period"]

    res = await client.put(
        f"/api/v1/companies/{seeded_company.id}/hiring/approve",
        json={"items": [{"period": period, "role_key": "backend", "approved_hires": 5}]},
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    roles = {r["role_key"]: r for r in res.json()["months"][0]["roles"]}
    assert roles["backend"]["approved_hires"] == 5


async def test_hiring_generate_persists(client, seeded_company, seeded_admin, db_session):
    await _seed_metric(db_session, seeded_company.id, revenue=100000, new_units=100)
    before = await _count_rows(db_session)

    res = await client.post(
        f"/api/v1/companies/{seeded_company.id}/hiring/generate",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    assert len(res.json()["months"]) == 12

    after = await _count_rows(db_session)
    assert after > before
    assert after - before == 12 * 10  # 12 месяцев × 10 ролей


async def test_hiring_get_does_not_persist(client, seeded_company, seeded_admin, db_session):
    await _seed_metric(db_session, seeded_company.id, revenue=100000, new_units=100)
    before = await _count_rows(db_session)

    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/hiring",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    assert await _count_rows(db_session) == before


async def test_hiring_write_forbidden_observer(client, seeded_company, seeded_observer):
    res = await client.put(
        f"/api/v1/companies/{seeded_company.id}/hiring/team",
        json={"role_key": "backend", "headcount": 1},
        headers=auth_headers(seeded_observer),
    )
    assert res.status_code == 403


async def test_hiring_unauthenticated(client, seeded_company):
    res = await client.get(f"/api/v1/companies/{seeded_company.id}/hiring")
    assert res.status_code == 401


async def test_hiring_deterministic_forecast_dates(db_session, seeded_company):
    await _seed_metric(db_session, seeded_company.id, revenue=100000, new_units=100)

    plan = await HiringService(db_session).build_plan(
        seeded_company.id, forecast_start=date(2026, 10, 1)
    )
    periods = [m.period for m in plan.months]
    assert periods[0] == date(2026, 10, 1)
    assert periods[-1] == date(2027, 9, 1)
    assert len(periods) == 12
