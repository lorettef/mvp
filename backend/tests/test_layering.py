"""Тест-аудит слоёв: сервисы не должны импортировать API-слой.

D8: `app.services` — нижний слой относительно `app.api`. Импорт
`app.api.*` из сервисов создаёт циклическую зависимость слоёв и
нарушает правило зависимостей (верхние слои зависят от нижних,
не наоборот). Константы ролей вынесены в `app.core.roles`.
"""

import ast
import pathlib


def test_services_do_not_import_api_layer():
    """Ни один модуль app/services не должен импортировать app.api.

    Проверяет AST каждого .py-файла в app/services: любые Import/ImportFrom
    с модулем `app.api*` — нарушение.
    """
    services_dir = (
        pathlib.Path(__file__).resolve().parent.parent / "app" / "services"
    )

    violations = []
    for py_file in sorted(services_dir.rglob("*.py")):
        tree = ast.parse(py_file.read_text(encoding="utf-8"), filename=str(py_file))
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom):
                module = node.module or ""
                if module.startswith("app.api"):
                    violations.append(
                        f"{py_file}:{node.lineno}: from {module} import ..."
                    )
            elif isinstance(node, ast.Import):
                for alias in node.names:
                    if alias.name.startswith("app.api"):
                        violations.append(
                            f"{py_file}:{node.lineno}: import {alias.name}"
                        )

    assert not violations, (
        "Найдены импорты app.api из app/services:\n" + "\n".join(violations)
    )
