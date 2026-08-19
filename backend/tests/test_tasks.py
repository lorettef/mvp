from datetime import date, timedelta

from .conftest import auth_headers


def _task_payload(title="Задача", stage="metrics", status="pending", due_date=None):
    payload = {"title": title, "stage": stage, "status": status}
    if due_date:
        payload["due_date"] = due_date
    return payload


def _url(company_id):
    return f"/api/v1/companies/{company_id}/tasks"


async def test_create_task(client, seeded_company, seeded_admin):
    res = await client.post(
        _url(seeded_company.id),
        json=_task_payload(title="Подготовить метрики"),
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 201
    body = res.json()
    assert body["title"] == "Подготовить метрики"
    assert body["stage"] == "metrics"
    assert body["status"] == "pending"
    assert body["effective_status"] == "pending"


async def test_list_tasks(client, seeded_company, seeded_admin):
    url = _url(seeded_company.id)
    await client.post(url, json=_task_payload(title="A"), headers=auth_headers(seeded_admin))
    await client.post(url, json=_task_payload(title="B"), headers=auth_headers(seeded_admin))
    res = await client.get(url, headers=auth_headers(seeded_admin))
    assert res.status_code == 200
    assert len(res.json()) == 2


async def test_update_task_status(client, seeded_company, seeded_admin):
    url = _url(seeded_company.id)
    created = await client.post(url, json=_task_payload(title="X"), headers=auth_headers(seeded_admin))
    task_id = created.json()["id"]
    res = await client.patch(
        f"{url}/{task_id}", json={"status": "done"}, headers=auth_headers(seeded_admin)
    )
    assert res.status_code == 200
    assert res.json()["status"] == "done"


async def test_delete_task(client, seeded_company, seeded_admin):
    url = _url(seeded_company.id)
    created = await client.post(url, json=_task_payload(title="Del"), headers=auth_headers(seeded_admin))
    task_id = created.json()["id"]
    res = await client.delete(f"{url}/{task_id}", headers=auth_headers(seeded_admin))
    assert res.status_code == 200
    res = await client.get(url, headers=auth_headers(seeded_admin))
    assert res.json() == []


async def test_invalid_stage_and_status(client, seeded_company, seeded_admin):
    url = _url(seeded_company.id)
    res = await client.post(url, json=_task_payload(stage="bogus"), headers=auth_headers(seeded_admin))
    assert res.status_code == 422
    res = await client.post(url, json=_task_payload(status="bogus"), headers=auth_headers(seeded_admin))
    assert res.status_code == 422


async def test_readiness_mixed(client, seeded_company, seeded_admin):
    url = _url(seeded_company.id)
    await client.post(url, json=_task_payload(title="1", stage="metrics", status="done"), headers=auth_headers(seeded_admin))
    await client.post(url, json=_task_payload(title="2", stage="documents", status="done"), headers=auth_headers(seeded_admin))
    await client.post(url, json=_task_payload(title="3", stage="negotiations", status="pending"), headers=auth_headers(seeded_admin))

    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/readiness",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["total_tasks"] == 3
    assert body["done_tasks"] == 2
    assert body["readiness"] == 67
    assert "Переговоры" in body["risks"]
    assert "Готовность 67%" in body["summary"]

    neg = [s for s in body["stages"] if s["stage"] == "negotiations"][0]
    assert neg["total"] == 1
    assert neg["done"] == 0


async def test_readiness_empty(client, seeded_company, seeded_admin):
    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/readiness",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["readiness"] == 0
    assert body["total_tasks"] == 0
    assert "Задачи ещё не добавлены" in body["summary"]


async def test_readiness_full(client, seeded_company, seeded_admin):
    url = _url(seeded_company.id)
    await client.post(url, json=_task_payload(title="1", stage="metrics", status="done"), headers=auth_headers(seeded_admin))
    await client.post(url, json=_task_payload(title="2", stage="presentation", status="done"), headers=auth_headers(seeded_admin))

    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/readiness",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["readiness"] == 100
    assert body["risks"] == []
    assert "Готовность 100%" in body["summary"]


async def test_overdue_effective_status(client, seeded_company, seeded_admin):
    past = (date.today() - timedelta(days=1)).isoformat()
    res = await client.post(
        _url(seeded_company.id),
        json=_task_payload(title="Overdue", due_date=past),
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 201
    assert res.json()["effective_status"] == "overdue"


async def test_observer_read_only(client, seeded_company, seeded_admin, seeded_observer):
    url = _url(seeded_company.id)
    await client.post(url, json=_task_payload(title="X"), headers=auth_headers(seeded_admin))

    # observer может читать
    res = await client.get(url, headers=auth_headers(seeded_observer))
    assert res.status_code == 200
    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/readiness",
        headers=auth_headers(seeded_observer),
    )
    assert res.status_code == 200

    # observer не может создавать
    res = await client.post(url, json=_task_payload(title="Y"), headers=auth_headers(seeded_observer))
    assert res.status_code == 403


async def test_dashboard_task_progress(client, seeded_company, seeded_admin):
    url = _url(seeded_company.id)
    await client.post(url, json=_task_payload(title="1", status="done"), headers=auth_headers(seeded_admin))
    await client.post(url, json=_task_payload(title="2", status="pending"), headers=auth_headers(seeded_admin))

    res = await client.get("/api/v1/dashboard", headers=auth_headers(seeded_admin))
    assert res.status_code == 200
    body = res.json()
    comp = [c for c in body["companies"] if c["id"] == str(seeded_company.id)][0]
    assert comp["task_progress"] == 50
