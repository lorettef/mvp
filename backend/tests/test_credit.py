from datetime import date

import pytest

from .conftest import auth_headers
from app.models.metric import Metric
from app.models.budget import Budget
from app.models.financing import Financing


async def _seed_company_data(db, company_id, mrr=50000, fot=30000):
    db.add(
        Metric(
            company_id=company_id,
            period=date(2026, 2, 1),
            type="fact",
            revenue=mrr,
            cac=1000,
            ltv=5000,
            churn=0.03,
        )
    )
    db.add(
        Budget(
            company_id=company_id,
            period=date(2026, 2, 1),
            type="fact",
            marketing=10000,
            development=20000,
            fot=fot,
            gna=5000,
        )
    )
    await db.flush()


async def test_credit_gap_detected(client, seeded_company, seeded_admin, db_session):
    # стартовый кэш 100000, ежемесячный убыток ~35k (fot=40000, соц. 30.2%) → разрыв
    db_session.add(
        Financing(company_id=seeded_company.id, type="investment", amount=100000)
    )
    await _seed_company_data(db_session, seeded_company.id, mrr=50000, fot=40000)

    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/credit-forecast",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()

    assert body["geography"] == "RU"
    assert body["key_rate"] == pytest.approx(21.0)
    assert body["credit_rate"] == pytest.approx(26.0)
    # opening_cash = фактический closing balance (инвестиция 100000 − убыток 37080)
    assert body["opening_cash"] == pytest.approx(62920)
    assert len(body["months"]) == 12

    assert len(body["gaps"]) >= 1
    first_gap = body["gaps"][0]
    assert first_gap["gap"] > 0
    assert first_gap["credit_amount"] == pytest.approx(
        round(first_gap["gap"] * 1.10, 2)
    )
    assert first_gap["rate"] == pytest.approx(26.0)

    # сумма кредита = сумма всех разрывов с буфером
    expected_total = round(
        sum(g["credit_amount"] for g in body["gaps"]), 2
    )
    assert body["total_credit_needed"] == pytest.approx(expected_total)
    assert body["funding_need"] == pytest.approx(expected_total)

    # после применения кредитов остаток неотрицателен во всех месяцах
    for m in body["months"]:
        assert m["balance_after"] >= 0


async def test_credit_no_gap(client, seeded_company, seeded_admin, db_session):
    # прибыльная компания без стартового кэша → разрывов нет
    await _seed_company_data(db_session, seeded_company.id, mrr=100000)

    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/credit-forecast",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["gaps"] == []
    assert body["total_credit_needed"] == 0
    assert len(body["months"]) == 12


async def test_credit_empty(client, seeded_company, seeded_admin):
    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/credit-forecast",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["base_revenue"] is None
    assert body["months"] == []
    assert body["gaps"] == []


async def test_credit_observer_read(client, seeded_company, seeded_observer):
    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/credit-forecast",
        headers=auth_headers(seeded_observer),
    )
    assert res.status_code == 200


async def test_credit_unauthenticated(client, seeded_company):
    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/credit-forecast"
    )
    assert res.status_code == 401


async def test_approved_hiring_affects_cash_gap(
    client, seeded_company, seeded_admin, db_session
):
    """Hiring → Payroll → Cash Gap: одобренный найм увеличивает OPEX прогноза."""
    await _seed_company_data(db_session, seeded_company.id, mrr=100000)

    base = await client.get(
        f"/api/v1/companies/{seeded_company.id}/credit-forecast",
        headers=auth_headers(seeded_admin),
    )
    base_opex = base.json()["months"][0]["opex"]

    plan = await client.get(
        f"/api/v1/companies/{seeded_company.id}/hiring",
        headers=auth_headers(seeded_admin),
    )
    period = plan.json()["months"][0]["period"]

    await client.put(
        f"/api/v1/companies/{seeded_company.id}/hiring/approve",
        json={"items": [{"period": period, "role_key": "backend", "approved_hires": 10}]},
        headers=auth_headers(seeded_admin),
    )

    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/credit-forecast",
        headers=auth_headers(seeded_admin),
    )
    new_opex = res.json()["months"][0]["opex"]
    # 10 backend × (150000 + 150000×0.302) = 1 953 000
    assert new_opex == pytest.approx(base_opex + 1953000)


async def test_no_double_count_forecast_payroll(
    client, seeded_company, seeded_admin, db_session
):
    """Budget.fot + HiringTeam не складываются: canonical payroll = только HiringTeam."""
    await _seed_company_data(db_session, seeded_company.id, mrr=100000)
    # Структурированная команда: 2 Backend × 150000
    await client.put(
        f"/api/v1/companies/{seeded_company.id}/hiring/team",
        json={"role_key": "backend", "headcount": 2, "salary": 150000},
        headers=auth_headers(seeded_admin),
    )

    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/credit-forecast",
        headers=auth_headers(seeded_admin),
    )
    m0 = res.json()["months"][0]
    # non-payroll = 10000+20000+5000 = 35000; payroll = 2×195300 = 390600
    # opex = 35000 + 390600 = 425600 (НЕ 35000 + 39060[budget.fot] + 390600)
    assert m0["opex"] == pytest.approx(425600)


async def test_salary_change_affects_forecast(
    client, seeded_company, seeded_admin, db_session
):
    """Изменение зарплаты команды детерминированно меняет forecast payroll."""
    await _seed_company_data(db_session, seeded_company.id, mrr=100000)
    await client.put(
        f"/api/v1/companies/{seeded_company.id}/hiring/team",
        json={"role_key": "backend", "headcount": 2, "salary": 150000},
        headers=auth_headers(seeded_admin),
    )
    before = await client.get(
        f"/api/v1/companies/{seeded_company.id}/credit-forecast",
        headers=auth_headers(seeded_admin),
    )
    before_opex = before.json()["months"][0]["opex"]

    # +50000 к зарплате → +2 × 50000 × (1 + 0.302) = 130200
    await client.put(
        f"/api/v1/companies/{seeded_company.id}/hiring/team",
        json={"role_key": "backend", "headcount": 2, "salary": 200000},
        headers=auth_headers(seeded_admin),
    )
    after = await client.get(
        f"/api/v1/companies/{seeded_company.id}/credit-forecast",
        headers=auth_headers(seeded_admin),
    )
    after_opex = after.json()["months"][0]["opex"]
    assert after_opex == pytest.approx(before_opex + 130200)


async def test_e2e_hiring_payroll_chain(client, seeded_company, seeded_admin, db_session):
    """E2E (Section 37): +1 Backend в месяц 3 → payroll растёт ровно на 195,300.

    Открывающий кэш 1M (investment); текущая команда 2 Backend × 150k;
    budget.fot=500k (legacy, НЕ должен складываться с HiringTeam).
    """
    from app.models.budget import Budget
    from app.models.hiring_team import HiringTeam
    from app.models.financing import Financing
    from app.models.metric import Metric

    db_session.add(Financing(company_id=seeded_company.id, type="investment", amount=1000000))
    db_session.add(HiringTeam(company_id=seeded_company.id, role_key="backend", headcount=2, salary=150000))
    db_session.add(Metric(
        company_id=seeded_company.id, period=date(2026, 9, 1), type="plan",
        revenue=2000000, new_units=100, active_units=500, cac=1000, ltv=5000, churn=0.03,
    ))
    db_session.add(Budget(
        company_id=seeded_company.id, period=date(2026, 9, 1), type="plan",
        marketing=0, development=0, fot=500000, gna=0,
    ))
    await db_session.flush()

    # Baseline: месяц 1 opex = canonical payroll 2×195300 = 390600
    # (НЕ 500000[budget.fot] + 390600)
    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/credit-forecast",
        headers=auth_headers(seeded_admin),
    )
    fc = res.json()
    assert fc["months"][0]["opex"] == pytest.approx(390600)

    # Одобряем +1 Backend в месяц 3
    plan = await client.get(
        f"/api/v1/companies/{seeded_company.id}/hiring",
        headers=auth_headers(seeded_admin),
    )
    m3_period = plan.json()["months"][2]["period"]
    await client.put(
        f"/api/v1/companies/{seeded_company.id}/hiring/approve",
        json={"items": [{"period": m3_period, "role_key": "backend", "approved_hires": 1}]},
        headers=auth_headers(seeded_admin),
    )

    # После одобрения: месяц 3 = 3×195300 = 585900, месяц 1 без изменений.
    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/credit-forecast",
        headers=auth_headers(seeded_admin),
    )
    fc2 = res.json()
    assert fc2["months"][0]["opex"] == pytest.approx(390600)
    assert fc2["months"][2]["opex"] == pytest.approx(585900)


async def test_recommended_loan_creates_future_debt_service(db_session, seeded_company):
    """Рекомендованный кредит должен создавать будущее обслуживание долга."""
    from app.services.credit_service import CreditService

    svc = CreditService(db_session)
    # Постоянный ежемесячный убыток 10000 при нулевом opening → разрыв в м.1,
    # затем обслуживание кредита добавляет новые разрывы в следующих месяцах.
    months, gaps = svc._project(0.0, 10000.0, 0.0, 26.0, 0.0, 0.0, 0.0)

    assert len(gaps) >= 2
    for m in months:
        assert m.balance_after >= 0
    # Сумма потребности растёт из-за долговой нагрузки, а не равна одному разрыву.
    total = sum(g.credit_amount for g in gaps)
    assert total > gaps[0].credit_amount
