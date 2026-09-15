from datetime import datetime, timezone

def utcnow():
    """Naive-UTC now (aware UTC stripped to tzinfo=None) — central timestamp helper."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def today():
    """Сегодняшняя дата в UTC — единый детерминированный источник даты."""
    return datetime.now(timezone.utc).date()
