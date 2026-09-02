from unittest.mock import AsyncMock

from .conftest import auth_headers, make_user


async def test_weekly_report_broadcast_scoped_to_org(
    client, db_session, seeded_admin, other_admin, monkeypatch
):
    """Рассылка еженедельных отчётов идёт только по админам организации вызывающего.

    QA (1) misleading-success: отрицательная проверка — мок send_email НЕ должен
    вызываться с email админа другой организации (other-admin@test.ru), а не только
    "вызван хотя бы раз". (2) stale-state: фикстуры seeded_admin (орг A) и
    other_admin (орг B) создают ОБЕ организации до запроса.
    """
    mock_send_email = AsyncMock(return_value=True)
    monkeypatch.setattr("app.api.v1.admin.send_email", mock_send_email)
    monkeypatch.setattr(
        "app.api.v1.admin.WeeklyReportService.build_report_html",
        AsyncMock(return_value=""),
    )

    res = await client.post(
        "/api/v1/admin/send-weekly-reports",
        headers=auth_headers(seeded_admin),
    )

    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1

    sent_to = [call.args[0] for call in mock_send_email.await_args_list]
    assert "admin@test.ru" in sent_to
    assert "other-admin@test.ru" not in sent_to


async def test_broadcast_admin_without_org_403(client, db_session):
    """Админ без организации получает 403 ещё до рассылки."""
    no_org_admin = await make_user(
        db_session, "no-org-admin@test.ru", "admin", None, None
    )

    res = await client.post(
        "/api/v1/admin/send-weekly-reports",
        headers=auth_headers(no_org_admin),
    )

    assert res.status_code == 403
