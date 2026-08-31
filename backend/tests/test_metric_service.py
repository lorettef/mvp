from datetime import date

import pytest

from .conftest import auth_headers
from app.schemas.metric import MetricUpsert, MetricBulkUpsert
from app.services.metric_service import MetricService


def _fact(period: date, new_units: int, arpu: float, retention: float, marketing: float = 0.0) -> MetricUpsert:
    return MetricUpsert(
        period=period,
        type="fact",
        new_units=new_units,
        arpu=arpu,
        revenue=arpu * new_units,
        marketing_spend=marketing,
        retention_rate=retention,
    )


async def test_upsert_derived_fields(db_session, seeded_company):
    svc = MetricService(db_session)
    data = MetricUpsert(
        period=date(2026, 1, 1),
        type="fact",
        new_units=45,
        arpu=95.0,
        revenue=4275.0,
        marketing_spend=14400.0,
        retention_rate=0.82,
    )

    m = await svc.upsert_metric(seeded_company.id, data)

    assert m.churn == pytest.approx(0.18)
    assert m.ltv == pytest.approx(527.78)
    assert m.cac == pytest.approx(320.0)  # 14400 / 45


async def test_upsert_zero_new_units_gives_zero_cac(db_session, seeded_company):
    svc = MetricService(db_session)
    data = _fact(date(2026, 1, 1), new_units=0, arpu=95.0, retention=0.8, marketing=14400.0)

    m = await svc.upsert_metric(seeded_company.id, data)

    assert m.cac == 0.0


async def test_upsert_full_retention(db_session, seeded_company):
    svc = MetricService(db_session)
    data = _fact(date(2026, 1, 1), new_units=10, arpu=100.0, retention=1.0, marketing=1000.0)

    m = await svc.upsert_metric(seeded_company.id, data)

    assert m.churn == 0.0
    assert m.ltv == pytest.approx(1200.0)  # arpu * 12


async def test_bulk_two_consecutive_months_recursive_active_units(db_session, seeded_company):
    svc = MetricService(db_session)
    items = [
        _fact(date(2026, 1, 1), new_units=100, arpu=10.0, retention=0.9),
        _fact(date(2026, 2, 1), new_units=50, arpu=10.0, retention=0.8),
    ]

    saved = await svc.bulk_upsert(seeded_company.id, items)

    assert [m.active_units for m in saved] == [100, 130]  # round(100*0.8)+50


async def test_bulk_gap_resets_active_units(db_session, seeded_company):
    svc = MetricService(db_session)
    items = [
        _fact(date(2026, 1, 1), new_units=100, arpu=10.0, retention=0.9),
        _fact(date(2026, 3, 1), new_units=50, arpu=10.0, retention=0.8),
    ]

    saved = await svc.bulk_upsert(seeded_company.id, items)

    assert [m.active_units for m in saved] == [100, 50]


async def test_bulk_plan_leaves_active_units_none(db_session, seeded_company):
    svc = MetricService(db_session)
    items = [
        MetricUpsert(
            period=date(2026, 1, 1),
            type="plan",
            new_units=100,
            arpu=10.0,
            revenue=1000.0,
            marketing_spend=500.0,
            retention_rate=0.9,
        )
    ]

    saved = await svc.bulk_upsert(seeded_company.id, items)

    assert saved[0].active_units is None


def test_bulk_schema_rejects_empty_items():
    with pytest.raises(Exception):
        MetricBulkUpsert.model_validate({"items": []})


async def test_bulk_endpoint_returns_ordered_responses(client, seeded_company, seeded_admin):
    payload = {
        "items": [
            {"period": "2026-01-01", "type": "fact", "new_units": 100, "arpu": 10.0,
             "revenue": 1000.0, "marketing_spend": 500.0, "retention_rate": 0.9},
            {"period": "2026-02-01", "type": "fact", "new_units": 50, "arpu": 10.0,
             "revenue": 500.0, "marketing_spend": 250.0, "retention_rate": 0.8},
        ]
    }
    res = await client.put(
        f"/api/v1/companies/{seeded_company.id}/metrics/bulk",
        json=payload,
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 2
    assert body[0]["period"] == "2026-01-01"
    assert body[0]["churn"] == pytest.approx(0.1)
    assert body[0]["active_units"] == 100
    assert body[1]["period"] == "2026-02-01"
    assert body[1]["active_units"] == 130


async def test_bulk_endpoint_observer_forbidden(client, seeded_company, seeded_observer):
    payload = {
        "items": [
            {"period": "2026-01-01", "type": "fact", "new_units": 1, "arpu": 10.0,
             "revenue": 10.0, "marketing_spend": 0.0, "retention_rate": 0.9},
        ]
    }
    res = await client.put(
        f"/api/v1/companies/{seeded_company.id}/metrics/bulk",
        json=payload,
        headers=auth_headers(seeded_observer),
    )
    assert res.status_code == 403
