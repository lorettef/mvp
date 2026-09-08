"""Trusted-proxy client IP extraction (SEC-003 fix)."""

from types import SimpleNamespace

from app.core.client_ip import get_client_ip
from app.core.config import settings


def _req(client_host, headers=None):
    return SimpleNamespace(
        client=SimpleNamespace(host=client_host) if client_host is not None else None,
        headers=headers or {},
    )


def test_direct_public_client_no_forwarded_headers():
    assert get_client_ip(_req("8.8.8.8")) == "8.8.8.8"


def test_spoofed_xff_from_untrusted_client_ignored():
    # Публичный peer (не loopback/private и не в TRUSTED_PROXIES) — заголовки не доверяются.
    req = _req("8.8.8.8", {"x-forwarded-for": "1.2.3.4, 5.6.7.8", "x-real-ip": "9.9.9.9"})
    assert get_client_ip(req) == "8.8.8.8"


def test_private_proxy_x_real_ip_trusted():
    # docker-сеть (private) с nginx: X-Real-IP пишет реальный клиент.
    req = _req("10.0.0.1", {"x-real-ip": "203.0.113.50"})
    assert get_client_ip(req) == "203.0.113.50"


def test_private_proxy_xff_uses_last_entry():
    # nginx дописывает реальный IP последним ($proxy_add_x_forwarded_for),
    # клиентские (спуфнутые) записи идут раньше.
    req = _req("172.17.0.1", {"x-forwarded-for": "1.2.3.4, 203.0.113.60"})
    assert get_client_ip(req) == "203.0.113.60"


def test_loopback_trusted_as_proxy():
    req = _req("127.0.0.1", {"x-real-ip": "203.0.113.70"})
    assert get_client_ip(req) == "203.0.113.70"


def test_explicit_trusted_proxy(monkeypatch):
    monkeypatch.setattr(settings, "TRUSTED_PROXIES", ["198.51.100.1"])
    req = _req("198.51.100.1", {"x-real-ip": "203.0.113.80"})
    assert get_client_ip(req) == "203.0.113.80"


def test_no_client_returns_unknown():
    assert get_client_ip(_req(None)) == "unknown"
