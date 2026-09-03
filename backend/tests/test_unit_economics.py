from datetime import date

from .conftest import auth_headers
from app.models.metric import Metric
from app.models.cohort import Cohort
from app.models.budget import Budget
from app.models.financing import Financing


async def _seed_unit_economics(db, company_id):
    """Два факт-периода (ΔRevenue), когорта, бюджет, финансирование."""
    db.add(Metric(
        company_id=company_id, period=date(2026, 1, 1), type="fact",
        revenue=100000, arpu=100, cac=1000, ltv=5000, churn=0.03,
    ))
    db.add(Metric(
        company_id=company_id, period=date(2026, 2, 1), type="fact",
        revenue=120000, arpu=100, cac=1000, ltv=5000, churn=0.03,
    ))
    db.add(Cohort(
        company_id=company_id, period=date(2026, 2, 1), type="fact",
        retention_m1=0.8, retention_m3=0.6, retention_m6=0.5, retention_m12=0.4,
    ))
    db.add(Budget(
        company_id=company_id, period=date(2026, 2, 1), type="fact",
        marketing=4000, development=8000, fot=6000, gna=2000,
    ))
    db.add(Financing(company_id=company_id, type="investment", amount=200000))
    db.add(Financing(company_id=company_id, type="credit", amount=100000, rate=0.15))
    await db.flush()


async def test_unit_economics_happy(client, seeded_company, seeded_admin, db_session):
    await _seed_unit_economics(db_session, seeded_company.id)

    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/unit-economics",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()

    assert body["revenue"] == 120000
    assert body["cac"] == 1000
    assert body["ltv"] == 5000
    assert body["churn"] == 0.03
    assert body["ltv_cac"] == 5.0
    # cash = 200000 + 100000 = 300000; burn = 4000+8000+6000+2000 = 20000
    assert body["cash"] == 300000
    assert body["monthly_burn"] == 20000
    assert body["runway_months"] == 15.0
    # ΔRevenue = 120000 - 100000 = 20000; marketing = 4000
    assert body["revenue_growth"] == 20000
    assert body["marketing_spend"] == 4000
    assert body["magic_number"] == 5.0
    # payback = cac / (arpu * gross_margin) = 1000 / (100 * 0.75) = 13.33
    assert body["payback_period"] == 13.33
    # romi = (ltv - cac) / cac = (5000 - 1000) / 1000 = 4.0
    assert body["romi"] == 4.0
    # retention
    assert body["retention"]["m1"] == 0.8
    assert body["retention"]["m3"] == 0.6
    assert body["retention"]["m6"] == 0.5
    assert body["retention"]["m12"] == 0.4
    # alerts — все показатели в норме
    assert any("LTV/CAC" in a for a in body["alerts"])
    assert any("Magic Number" in a for a in body["alerts"])
    assert any("Runway" in a for a in body["alerts"])


async def test_unit_economics_partial_retention(
    client, seeded_company, seeded_admin, db_session
):
    """Когорта с частичным retention (None) не роняет расчёт; недостающие = None."""
    db_session.add(
        Metric(
            company_id=seeded_company.id, period=date(2026, 2, 1), type="fact",
            revenue=100000, arpu=100, cac=1000, ltv=5000, churn=0.03,
        )
    )
    db_session.add(
        Cohort(
            company_id=seeded_company.id, period=date(2026, 2, 1), type="fact",
            retention_m1=0.8,
        )
    )
    await db_session.flush()

    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/unit-economics",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()

    assert body["retention"]["m1"] == 0.8
    assert body["retention"]["m3"] is None
    assert body["retention"]["m6"] is None
    assert body["retention"]["m12"] is None


async def test_unit_economics_uses_plan_fallback_when_fact_missing(
    client, seeded_company, seeded_admin, db_session
):
    """D1: при отсутствии факт-метрик юнит-экономика считает из плана (fallback)."""
    db_session.add(
        Metric(
            company_id=seeded_company.id, period=date(2026, 2, 1), type="plan",
            revenue=90000, arpu=90, cac=1200, ltv=4000, churn=0.04,
        )
    )
    await db_session.flush()

    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/unit-economics",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()

    # revenue (и остальные метрики) посчитаны из plan-метрики
    assert body["revenue"] == 90000
    assert body["ltv"] == 4000
    assert body["cac"] == 1200


async def test_unit_economics_empty(client, seeded_company, seeded_admin):
    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/unit-economics",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()

    assert body["revenue"] is None
    assert body["cac"] is None
    assert body["ltv"] is None
    assert body["churn"] is None
    assert body["ltv_cac"] is None
    assert body["cash"] is None
    assert body["monthly_burn"] is None
    assert body["runway_months"] is None
    assert body["revenue_growth"] is None
    assert body["magic_number"] is None
    assert body["payback_period"] is None
    assert body["romi"] is None
    assert body["retention"]["m1"] is None
    assert body["retention"]["m12"] is None
    assert body["alerts"] == []


async def test_unit_economics_div_by_zero(client, seeded_company, seeded_admin, db_session):
    # бюджет с нулевыми статьями и маркетингом = 0; финансирование есть
    db_session.add(Budget(
        company_id=seeded_company.id, period=date(2026, 2, 1), type="fact",
        marketing=0, development=0, fot=0, gna=0,
    ))
    db_session.add(Financing(company_id=seeded_company.id, type="investment", amount=100000))
    db_session.add(Metric(
        company_id=seeded_company.id, period=date(2026, 2, 1), type="fact",
        revenue=50000, cac=1000, ltv=3000, churn=0.04,
    ))
    await db_session.flush()

    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/unit-economics",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()

    assert body["cash"] == 100000
    assert body["monthly_burn"] == 0
    assert body["runway_months"] is None  # деление на 0
    assert body["marketing_spend"] == 0
    assert body["magic_number"] is None  # деление на 0
    # нет NaN/Infinity в ответе
    assert body["runway_months"] != float("nan")
    assert body["magic_number"] != float("nan")


async def test_unit_economics_observer_read(client, seeded_company, seeded_observer):
    """Наблюдатель имеет read-only доступ к юнит-экономике."""
    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/unit-economics",
        headers=auth_headers(seeded_observer),
    )
    assert res.status_code == 200


async def test_unit_economics_unauthenticated(client, seeded_company):
    res = await client.get(f"/api/v1/companies/{seeded_company.id}/unit-economics")
    assert res.status_code == 401
