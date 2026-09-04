"""Unit tests for the data-driven metric catalog (app/core/metric_catalog.py)."""

import pytest

from app.core.metric_catalog import (
    BUSINESS_MODELS,
    INDUSTRIES,
    METRIC_KEYS,
    DERIVED_KEYS,
    business_models_for,
    default_business_model,
    default_industry,
    describe_company,
    get_profile,
    list_business_models,
    list_industries,
)


def test_business_models_count():
    assert len(BUSINESS_MODELS) == 6


def test_business_model_slugs_distinct_from_industry_slugs():
    # Business-model slugs must not collide with industry slugs.
    overlap = set(BUSINESS_MODELS) & set(INDUSTRIES)
    assert not overlap, f"Slugs in both namespaces: {overlap}"


def test_saas_subscription_profile_has_required_metrics():
    profile = get_profile("saas", "subscription")
    keys = [m["key"] for m in profile["metrics"]]
    for required_key in ("new_units", "arpu", "revenue", "marketing_spend", "retention_rate"):
        assert required_key in keys
    # Every input metric key must be drawn from the fixed Metric vocabulary.
    for key in keys:
        assert key in METRIC_KEYS
    # Derived keys come from the derived vocabulary.
    for derived in profile["derived"]:
        assert derived in DERIVED_KEYS


def test_saas_subscription_metric_labels():
    profile = get_profile("saas", "subscription")
    labels = {m["key"]: m["label"] for m in profile["metrics"]}
    assert labels["new_units"] == "Новые платящие клиенты"
    assert labels["arpu"] == "Средняя выручка на клиента"
    assert labels["retention_rate"] == "Удержание подписчиков"


def test_non_saas_profile_has_own_labels():
    profile = get_profile("ecommerce", "marketplace")
    labels = {m["label"] for m in profile["metrics"]}
    assert "Комиссия с транзакции (take rate)" in labels
    assert "Новые активные покупатели" in labels
    # Distinct from the subscription labels.
    assert "Новые платящие клиенты" not in labels


def test_business_models_for_saas_non_empty():
    models = business_models_for("saas")
    assert models
    assert "subscription" in models


def test_unknown_slugs_raise_key_error():
    with pytest.raises(KeyError):
        get_profile("bogus_industry", "subscription")
    with pytest.raises(KeyError):
        get_profile("saas", "bogus_model")


def test_list_industries_matches_frontend_enum():
    industries = list_industries()
    slugs = [i["slug"] for i in industries]
    assert len(slugs) == 15
    assert slugs[0] == "saas"
    assert "other" in slugs
    assert all({"slug", "label"} == set(i.keys()) for i in industries)


def test_list_business_models_has_slug_label_description():
    models = list_business_models()
    assert len(models) == 6
    assert all({"slug", "label", "description"} == set(m.keys()) for m in models)


def test_defaults():
    assert default_industry() == "saas"
    assert default_business_model() == "subscription"


def test_describe_company_full_profile():
    text = describe_company(
        "saas",
        "subscription",
        "Германия",
        ["new_units", "arpu", "revenue", "retention_rate"],
    )
    assert "SaaS" in text
    assert "Подписка (SaaS)" in text
    assert "Германия" in text
    assert "Удержание подписчиков" in text


def test_describe_company_distinguishes_marketplace():
    saas_text = describe_company("saas", "subscription", None, None)
    mkt_text = describe_company("ecommerce", "marketplace", None, None)
    assert "Подписка (SaaS)" in saas_text
    assert "Маркетплейс" in mkt_text
    assert saas_text != mkt_text


def test_describe_company_empty():
    assert describe_company(None, None, None) == "профиль компании не указан"


def test_describe_company_ignores_unknown_slugs():
    text = describe_company("bogus", "bogus_model", None, None)
    assert text == "профиль компании не указан"
