from ipaddress import ip_address

from app.core.config import settings


def _is_loopback_or_private(ip: str) -> bool:
    try:
        addr = ip_address(ip)
    except ValueError:
        return False
    return addr.is_loopback or addr.is_private


def get_client_ip(request) -> str:
    """Реальный IP клиента с учётом доверенного reverse-proxy.

    X-Real-IP / X-Forwarded-For читаются ТОЛЬКО если непосредственный peer
    (request.client.host) является доверенным прокси: явно перечислен в
    TRUSTED_PROXIES либо находится в loopback/private-диапазоне (docker-сеть
    с nginx). Во всех остальных случаях берётся request.client.host — так
    внешний клиент не может подделать заголовки и обойти rate limiting.

    Приоритет: X-Real-IP (nginx пишет туда $remote_addr, перезаписывая
    клиентский заголовок) → последний элемент X-Forwarded-For (nginx дописывает
    реальный IP последним через $proxy_add_x_forwarded_for).
    """
    client_host = request.client.host if request.client else None
    if client_host is None:
        return "unknown"

    trusted = client_host in settings.TRUSTED_PROXIES or _is_loopback_or_private(client_host)
    if trusted:
        x_real_ip = request.headers.get("x-real-ip")
        if x_real_ip:
            return x_real_ip.strip()
        x_forwarded_for = request.headers.get("x-forwarded-for")
        if x_forwarded_for:
            return x_forwarded_for.split(",")[-1].strip()

    return client_host
