"""Static parameter inference for SSVP step scripts.

Scripts read their inputs from ``SSVP_INPUT_JSON`` and typically access
``payload["parameters"]`` (aliased as ``params``/``parameters``). This module
walks the script source (AST first, regex as a fallback) and discovers the
parameter keys, their inferred type, whether they look required, and a default
value when the script provides one.

Kept dependency-free (only stdlib) so it can be imported by both the HTTP
routes and the orchestrator store without creating import cycles.
"""

from __future__ import annotations

import ast
import re
from ast import literal_eval


_PARAM_GET_PATTERN = re.compile(
    r"(?:params|parameters)\.get\(\s*['\"]([a-zA-Z0-9_\-\.]+)['\"](?:\s*,\s*(.+?))?\s*\)"
)


def _infer_param_type(default_value) -> str:
    if isinstance(default_value, bool):
        return "boolean"
    if isinstance(default_value, (int, float)):
        return "number"
    if isinstance(default_value, list):
        return "list"
    if isinstance(default_value, dict):
        return "object"
    return "string"


def _safe_literal(default_expr):
    if default_expr is None:
        return ""

    if isinstance(default_expr, ast.AST):
        try:
            return literal_eval(default_expr)
        except Exception:
            return ""

    token = str(default_expr).strip()
    if not token:
        return ""

    try:
        return literal_eval(token)
    except Exception:
        return token.strip("\"'")


def _node_str_key(node) -> str:
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return str(node.value).strip()
    return ""


def _extract_assign_target_names(node) -> list[str]:
    if isinstance(node, ast.Name):
        return [node.id]
    if isinstance(node, (ast.Tuple, ast.List)):
        names: list[str] = []
        for item in node.elts:
            names.extend(_extract_assign_target_names(item))
        return names
    return []


def _is_load_call(node) -> bool:
    return isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "_load"


def _is_parameters_lookup(node, payload_aliases: set[str]) -> bool:
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "get":
        receiver = node.func.value
        if not isinstance(receiver, ast.Name) or receiver.id not in payload_aliases:
            return False

        if not node.args:
            return False
        key = _node_str_key(node.args[0])
        return key == "parameters"

    if isinstance(node, ast.Subscript) and isinstance(node.value, ast.Name):
        key = _node_str_key(node.slice)
        return key == "parameters"

    return False


def _register_param_candidate(bucket: dict[str, dict], order: list[str], *, key: str, default_value, required: bool) -> None:
    normalized = str(key or "").strip()
    if not normalized:
        return

    if normalized not in bucket:
        bucket[normalized] = {
            "key": normalized,
            "label": normalized.replace("_", " ").strip().title(),
            "type": _infer_param_type(default_value),
            "required": bool(required),
            "default": default_value,
            "sort_order": len(order) * 10,
        }
        order.append(normalized)
        return

    current = bucket[normalized]
    current["required"] = bool(current.get("required") or required)
    if current.get("default") in ("", None) and default_value not in ("", None):
        current["default"] = default_value
        current["type"] = _infer_param_type(default_value)


def _infer_parameter_schema_from_ast(source: str) -> list[dict]:
    try:
        tree = ast.parse(source)
    except Exception:
        return []

    payload_aliases: set[str] = {"payload"}
    param_aliases: set[str] = {"params", "parameters"}
    saw_parameters_container = False

    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            value = node.value
            target_names: list[str] = []
            for target in node.targets:
                target_names.extend(_extract_assign_target_names(target))

            if _is_load_call(value):
                for name in target_names:
                    payload_aliases.add(name)
                continue

            if isinstance(value, ast.Name) and value.id in payload_aliases:
                for name in target_names:
                    payload_aliases.add(name)
                continue

        if isinstance(node, ast.AnnAssign):
            value = node.value
            if value is None:
                continue

            target_names = _extract_assign_target_names(node.target)
            if _is_load_call(value):
                for name in target_names:
                    payload_aliases.add(name)
                continue

            if isinstance(value, ast.Name) and value.id in payload_aliases:
                for name in target_names:
                    payload_aliases.add(name)

    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            value = node.value
            target_names = []
            for target in node.targets:
                target_names.extend(_extract_assign_target_names(target))

            if _is_parameters_lookup(value, payload_aliases):
                saw_parameters_container = True
                for name in target_names:
                    param_aliases.add(name)
                continue

            if isinstance(value, ast.Name) and value.id in param_aliases:
                for name in target_names:
                    param_aliases.add(name)
                continue

        if isinstance(node, ast.AnnAssign):
            target_names = _extract_assign_target_names(node.target)
            value = node.value
            if value is None:
                continue

            if _is_parameters_lookup(value, payload_aliases):
                saw_parameters_container = True
                for name in target_names:
                    param_aliases.add(name)
                continue

            if isinstance(value, ast.Name) and value.id in param_aliases:
                for name in target_names:
                    param_aliases.add(name)

    found: dict[str, dict] = {}
    order: list[str] = []

    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "get":
            receiver = node.func.value
            if not isinstance(receiver, ast.Name) or receiver.id not in param_aliases:
                continue

            if not node.args:
                continue

            key = _node_str_key(node.args[0])
            if not key:
                continue

            default_expr = node.args[1] if len(node.args) > 1 else None
            required = default_expr is None
            default_value = _safe_literal(default_expr)
            _register_param_candidate(found, order, key=key, default_value=default_value, required=required)
            continue

        if isinstance(node, ast.Subscript) and isinstance(node.value, ast.Name) and node.value.id in param_aliases:
            key = _node_str_key(node.slice)
            if key:
                _register_param_candidate(found, order, key=key, default_value="", required=True)
            continue

        if isinstance(node, ast.Compare) and node.ops:
            if not isinstance(node.left, ast.Constant) or not isinstance(node.left.value, str):
                continue
            key = str(node.left.value).strip()
            if not key:
                continue
            for comparator in node.comparators:
                if isinstance(comparator, ast.Name) and comparator.id in param_aliases:
                    _register_param_candidate(found, order, key=key, default_value="", required=False)
                    break

    discovered = [found[key] for key in order]
    if discovered:
        return discovered

    if saw_parameters_container:
        return [
            {
                "key": "parameters",
                "label": "Parameters",
                "type": "object",
                "required": False,
                "default": {},
                "sort_order": 0,
            }
        ]

    return []


def _infer_parameter_schema_with_regex(source: str) -> list[dict]:
    discovered: list[dict] = []
    by_key: dict[str, dict] = {}

    for line in source.splitlines():
        match = _PARAM_GET_PATTERN.search(line)
        if not match:
            continue

        key = str(match.group(1) or "").strip()
        if not key:
            continue

        default_expr = match.group(2)
        default_value = _safe_literal(default_expr) if default_expr else ""
        inferred = {
            "key": key,
            "label": key.replace("_", " ").strip().title(),
            "type": _infer_param_type(default_value),
            "required": False,
            "default": default_value,
            "sort_order": len(discovered) * 10,
        }

        existing = by_key.get(key)
        if existing is None:
            discovered.append(inferred)
            by_key[key] = inferred
            continue

        if existing.get("default") in ("", None) and inferred.get("default") not in ("", None):
            existing["default"] = inferred.get("default")
            existing["type"] = inferred.get("type")

    return discovered


def infer_parameter_schema(source: str) -> list[dict]:
    """Return the inferred parameter schema for a script's source code.

    Each entry: ``{key, label, type, required, default, sort_order}``.
    AST inference is authoritative; regex fills in keys the AST pass missed.
    """
    if not source or not source.strip():
        return []

    discovered = _infer_parameter_schema_from_ast(source)
    regex_candidates = _infer_parameter_schema_with_regex(source)

    if not discovered:
        return regex_candidates

    known_keys = {str(item.get("key") or "").strip() for item in discovered}
    next_order = max([int(item.get("sort_order") or 0) for item in discovered], default=0) + 10
    for candidate in regex_candidates:
        key = str(candidate.get("key") or "").strip()
        if not key or key in known_keys:
            continue
        candidate["sort_order"] = next_order
        next_order += 10
        discovered.append(candidate)
        known_keys.add(key)

    return discovered
