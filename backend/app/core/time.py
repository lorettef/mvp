from datetime import datetime, timezone

def utcnow():
    """Naive-UTC now (aware UTC stripped to tzinfo=None) — central timestamp helper."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
