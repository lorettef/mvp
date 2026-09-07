"""Deterministic business-health signal evaluation.

Pure functions only — no database access. All thresholds and status rules live
here as module constants (single source of truth), consumed by
`HealthService` (per-company) and `DashboardService` (batched portfolio) so the
dashboard never re-implements health logic in JSX.

The module answers one question in a fully explainable way:

    DATA → deterministic signals (revenue/retention/cac/burn/runway)
         → aggregate status: healthy | attention | critical | no_data

There is deliberately NO composite "AI score 0–100": every signal and the final
status can be traced to a concrete rule below.
"""

from typing import Optional

# Runway thresholds (months). Cash / monthly burn.
RUNWAY_CRITICAL = 3.0
RUNWAY_WARNING = 6.0
RUNWAY_GOOD = 12.0

# Churn above this is treated as a critical retention signal (retention < 0.80).
CHURN_CRITICAL = 0.20

# Aggregate status vocabulary.
STATUS_HEALTHY = "healthy"
STATUS_ATTENTION = "attention"
STATUS_CRITICAL = "critical"
STATUS_NO_DATA = "no_data"

# Signal direction vocabulary.
DIRECTION_UP = "up"
DIRECTION_DOWN = "down"
DIRECTION_FLAT = "flat"
DIRECTION_UNKNOWN = "unknown"

# Signal status vocabulary.
SIGNAL_GOOD = "good"
SIGNAL_BAD = "bad"
SIGNAL_NEUTRAL = "neutral"
SIGNAL_UNKNOWN = "unknown"


def trend_direction(prev: Optional[float], current: Optional[float]) -> str:
    """Month-over-month direction of a metric; 'unknown' when not enough data."""
    if prev is None or current is None:
        return DIRECTION_UNKNOWN
    if current > prev:
        return DIRECTION_UP
    if current < prev:
        return DIRECTION_DOWN
    return DIRECTION_FLAT


def runway_months(cash: Optional[float], burn: Optional[float]) -> Optional[float]:
    """Runway = cash / monthly burn; None when not computable."""
    if cash is None or burn is None or burn <= 0:
        return None
    return round(cash / burn, 1)


def _revenue_signal(prev_revenue, revenue) -> dict:
    direction = trend_direction(prev_revenue, revenue)
    status = {
        DIRECTION_UP: SIGNAL_GOOD,
        DIRECTION_DOWN: SIGNAL_BAD,
        DIRECTION_FLAT: SIGNAL_NEUTRAL,
        DIRECTION_UNKNOWN: SIGNAL_UNKNOWN,
    }[direction]
    return {"key": "revenue", "direction": direction, "status": status,
            "label": _signal_label("Выручка", direction, status)}


def _retention_signal(prev_retention, retention) -> dict:
    direction = trend_direction(prev_retention, retention)
    status = {
        DIRECTION_UP: SIGNAL_GOOD,
        DIRECTION_DOWN: SIGNAL_BAD,
        DIRECTION_FLAT: SIGNAL_NEUTRAL,
        DIRECTION_UNKNOWN: SIGNAL_UNKNOWN,
    }[direction]
    return {"key": "retention", "direction": direction, "status": status,
            "label": _signal_label("Удержание", direction, status)}


def _cac_signal(prev_cac, cac) -> dict:
    # CAC is inverted: a falling CAC is good, a rising CAC is bad.
    direction = trend_direction(prev_cac, cac)
    status = {
        DIRECTION_UP: SIGNAL_BAD,
        DIRECTION_DOWN: SIGNAL_GOOD,
        DIRECTION_FLAT: SIGNAL_NEUTRAL,
        DIRECTION_UNKNOWN: SIGNAL_UNKNOWN,
    }[direction]
    return {"key": "cac", "direction": direction, "status": status,
            "label": _signal_label("CAC", direction, status)}


def _burn_signal(prev_burn, burn, revenue) -> dict:
    direction = trend_direction(prev_burn, burn)
    if burn is not None and revenue is not None:
        status = SIGNAL_BAD if burn > revenue else SIGNAL_GOOD
    else:
        status = SIGNAL_NEUTRAL
    return {"key": "burn", "direction": direction, "status": status,
            "label": _signal_label("Расходы (burn)", direction, status)}


def _runway_signal(runway) -> dict:
    if runway is None:
        return {"key": "runway", "direction": DIRECTION_UNKNOWN,
                "status": SIGNAL_UNKNOWN, "label": "Runway: нет данных"}
    if runway < RUNWAY_CRITICAL:
        status = SIGNAL_BAD
    elif runway < RUNWAY_GOOD:
        status = SIGNAL_NEUTRAL
    else:
        status = SIGNAL_GOOD
    return {"key": "runway", "direction": DIRECTION_UNKNOWN, "status": status,
            "label": f"Runway: {runway:.1f} мес."}


def _signal_label(name: str, direction: str, status: str) -> str:
    arrow = {
        DIRECTION_UP: "растёт",
        DIRECTION_DOWN: "снижается",
        DIRECTION_FLAT: "стабильно",
        DIRECTION_UNKNOWN: "нет данных",
    }[direction]
    return f"{name} {arrow}"


def evaluate_health(
    *,
    revenue: Optional[float],
    prev_revenue: Optional[float],
    retention: Optional[float],
    prev_retention: Optional[float],
    cac: Optional[float],
    prev_cac: Optional[float],
    churn: Optional[float],
    plan_revenue: Optional[float],
    burn: Optional[float],
    prev_burn: Optional[float],
    cash: Optional[float],
):
    """Evaluate deterministic health signals, aggregate status and attention items.

    Returns a tuple `(status, signals, attention)`:
    - `status` — healthy | attention | critical | no_data
    - `signals` — list of dicts with keys `key`, `direction`, `status`, `label`
    - `attention` — list of dicts with keys `kind`, `label`, `severity`
    """
    runway = runway_months(cash, burn)

    if revenue is None:
        return STATUS_NO_DATA, [], attention_signals(
            STATUS_NO_DATA, None, None, None, []
        )

    signals = [
        _revenue_signal(prev_revenue, revenue),
        _retention_signal(prev_retention, retention),
        _cac_signal(prev_cac, cac),
        _burn_signal(prev_burn, burn, revenue),
        _runway_signal(runway),
    ]

    # Aggregate status — fully deterministic.
    critical = (
        (runway is not None and runway < RUNWAY_CRITICAL)
        or (burn is not None and revenue is not None and burn > revenue)
        or (churn is not None and churn > CHURN_CRITICAL)
    )
    if critical:
        status = STATUS_CRITICAL
    else:
        attention = (
            (runway is not None and runway < RUNWAY_WARNING)
            or (plan_revenue is not None and revenue < plan_revenue)
            or (prev_retention is not None and retention is not None and retention < prev_retention)
            or (prev_cac is not None and cac is not None and cac > prev_cac)
        )
        status = STATUS_ATTENTION if attention else STATUS_HEALTHY

    attention = attention_signals(status, revenue, plan_revenue, runway, signals)
    return status, signals, attention


def attention_signals(
    status: str,
    revenue: Optional[float],
    plan_revenue: Optional[float],
    runway: Optional[float],
    signals: list[dict],
) -> list[dict]:
    """Concrete, deterministic reasons a company requires attention."""
    if status == STATUS_NO_DATA:
        return [{"kind": "no_data", "label": "Нет данных", "severity": "info"}]

    items: list[dict] = []
    if plan_revenue is None:
        items.append({"kind": "no_plan", "label": "Нет плана для сравнения", "severity": "info"})
    elif revenue is not None and revenue < plan_revenue:
        items.append({"kind": "behind_plan", "label": "Отстаёт от плана", "severity": "warning"})

    for s in signals:
        if s["status"] != SIGNAL_BAD:
            continue
        key = s["key"]
        if key == "revenue":
            items.append({"kind": "revenue_declining", "label": "Выручка снижается", "severity": "warning"})
        elif key == "retention":
            items.append({"kind": "retention_declining", "label": "Удержание снижается", "severity": "warning"})
        elif key == "cac":
            items.append({"kind": "cac_rising", "label": "CAC растёт", "severity": "warning"})
        elif key == "burn":
            items.append({"kind": "burn_exceeds_revenue", "label": "Расходы превышают выручку", "severity": "critical"})
        elif key == "runway":
            severity = "critical" if runway is not None and runway < RUNWAY_CRITICAL else "warning"
            items.append({"kind": "runway_low", "label": "Заканчивается runway", "severity": severity})

    return items


def summarize(status: str, signals: list[dict]) -> str:
    """Human-readable Russian summary for the health status."""
    if status == STATUS_NO_DATA:
        return "Недостаточно данных: добавьте метрики, чтобы оценить состояние бизнеса."
    bad = [s["label"] for s in signals if s["status"] == SIGNAL_BAD]
    if status == STATUS_CRITICAL:
        prefix = "Критично: "
    elif status == STATUS_ATTENTION:
        prefix = "Требует внимания: "
    else:
        return "Бизнес в норме — значимых негативных сигналов нет."
    if not bad:
        return prefix + "есть отклонения в ключевых метриках."
    return prefix + "; ".join(bad) + "."
