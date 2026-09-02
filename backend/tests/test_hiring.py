from datetime import date

import pytest
from sqlalchemy import select, func

from .conftest import auth_headers
from app.models.hiring_plan import HiringPlan
from app.models.metric import Metric
from app.services.hiring_service import HiringService


async def _count_hiring_rows(db) -> int:
    result = await db.execute(select(func.count()).select_from(HiringPlan))
    return result.scalar_one()


async def _seed_metric(db, company_id, revenue=100000, type_="plan"):
    db.add(
        Metric(
            company_id=company_id,
            period=date(2026, 1, 1),
            type=type_,
            revenue=revenue,
            cac=1000,
            ltv=5000,
            churn=0.03,
        )
    )
    await db.flush()


async def test_get_hiring_plan_generates_12_months(
    client, seeded_company, seeded_admin, db_session
):
    await _seed_metric(db_session, seeded_company.id, revenue=100000)

    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/hiring",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()

    assert body["industry"] == "saas"
    assert body["industry_label"] == "SaaS"
    assert body["base_revenue"] == 100000
    assert body["fot_share"] == pytest.approx(0.35)
    assert len(body["months"]) == 12

    m1 = body["months"][0]
    # Выручка растёт на 5%/мес
    assert m1["revenue"] == pytest.approx(105000)
    assert m1["fot"] == pytest.approx(m1["revenue"] * 0.35)
    # суммарный тариф соц. платежей по умолчанию = 0.432
    assert body["settings"]["total_rate"] == pytest.approx(0.432)
    assert m1["social_payments"] == pytest.approx(m1["fot"] * 0.432)
    # штат распределяется по отраслевым коэффициентам, сумма сходится
    assert m1["headcount"] >= 1
    assert (
        m1["headcount"]
        == m1["dev_count"] + m1["sales_count"] + m1["marketing_count"]
    )
    # итоговый штат — штат последнего месяца
    assert body["final_headcount"] == body["months"][-1]["headcount"]


async def test_hiring_plan_no_metrics_empty(client, seeded_company, seeded_admin):
    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/hiring",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["base_revenue"] is None
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
    assert res.json()["base_revenue"] == 80000


async def test_hiring_prefers_plan_over_fact(db_session, seeded_company):
    """Characterization: базовая выручка берётся из Плана, даже если есть свежий Факт."""
    await _seed_metric(db_session, seeded_company.id, revenue=100000, type_="plan")
    await _seed_metric(db_session, seeded_company.id, revenue=50000, type_="fact")

    plan = await HiringService(db_session).build_plan(seeded_company.id)
    assert plan.base_revenue == 100000.0


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


async def test_hiring_settings_upsert_affects_plan(
    client, seeded_company, seeded_admin, db_session
):
    # 1. обновляем настройки соц. платежей
    res = await client.put(
        f"/api/v1/companies/{seeded_company.id}/hiring/settings",
        json={"ndfl_rate": 0.15, "insurance_rate": 0.30, "injury_rate": 0.005},
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    assert res.json()["total_rate"] == pytest.approx(0.455)

    # 2. добавляем метрику и проверяем, что план использует новые настройки
    await _seed_metric(db_session, seeded_company.id, revenue=100000)

    plan = await client.get(
        f"/api/v1/companies/{seeded_company.id}/hiring",
        headers=auth_headers(seeded_admin),
    )
    assert plan.status_code == 200
    body = plan.json()
    assert body["settings"]["total_rate"] == pytest.approx(0.455)
    m1 = body["months"][0]
    assert m1["social_payments"] == pytest.approx(m1["fot"] * 0.455)


async def test_hiring_settings_forbidden_observer(client, seeded_company, seeded_observer):
    res = await client.put(
        f"/api/v1/companies/{seeded_company.id}/hiring/settings",
        json={"ndfl_rate": 0.15, "insurance_rate": 0.30, "injury_rate": 0.005},
        headers=auth_headers(seeded_observer),
    )
    assert res.status_code == 403


async def test_hiring_unauthenticated(client, seeded_company):
    res = await client.get(f"/api/v1/companies/{seeded_company.id}/hiring")
    assert res.status_code == 401


async def test_get_hiring_does_not_persist(
    client, seeded_company, seeded_admin, db_session
):
    await _seed_metric(db_session, seeded_company.id, revenue=100000)
    before = await _count_hiring_rows(db_session)

    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/hiring",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    assert len(res.json()["months"]) == 12

    after = await _count_hiring_rows(db_session)
    # GET /hiring — read-only: в БД не должно появиться строк hiring_plans.
    assert after == before


async def test_post_hiring_generate_persists_and_requires_role(
    client, seeded_company, seeded_observer, seeded_company_user, db_session
):
    await _seed_metric(db_session, seeded_company.id, revenue=100000)
    before = await _count_hiring_rows(db_session)

    # observer не может генерировать (записывать) план.
    res = await client.post(
        f"/api/v1/companies/{seeded_company.id}/hiring/generate",
        headers=auth_headers(seeded_observer),
    )
    assert res.status_code == 403

    # роль company может генерировать план.
    res = await client.post(
        f"/api/v1/companies/{seeded_company.id}/hiring/generate",
        headers=auth_headers(seeded_company_user),
    )
    assert res.status_code == 200
    body = res.json()
    assert len(body["months"]) == 12

    after = await _count_hiring_rows(db_session)
    # POST /hiring/generate — персистит 12 строк плана в hiring_plans.
    assert after > before
    assert after - before == len(body["months"])
