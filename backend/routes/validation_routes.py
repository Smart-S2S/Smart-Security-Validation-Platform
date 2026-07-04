import json
import os
import re
import subprocess
import sys
import time
import ast
import hashlib
from ast import literal_eval

from pydantic import BaseModel, Field

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status

from backend.ai.ollama_client import analyze_evidence_with_ai, suggest_action_intents
from backend.auth import require_roles
from backend.i18n import request_lang, t
from backend.services.auth_store import ROLE_ATTACK, ROLE_REMEDIATION, ROLE_TEST
from backend.services.orchestrator_store import (
    create_validation_action,
    get_step_item_script_content,
    get_workflow_step,
    list_step_item_parameters,
    list_step_items,
    list_validation_actions,
    list_workflow_steps,
)
from backend.services.validation_execution_store import (
    append_log,
    create_execution,
    get_execution,
    set_error,
    set_result,
    set_status,
)


router = APIRouter()

_SCRIPT_TEMPLATE_VERSION = "SSVP_SCRIPT_TEMPLATE_V1"
_PARAM_GET_PATTERN = re.compile(r"(?:params|parameters)\.get\(\s*['\"]([a-zA-Z0-9_\-\.]+)['\"](?:\s*,\s*(.+?))?\s*\)")


def _normalize_action(value: str | None) -> str:
    return str(value or "").strip().lower()


def _coerce_default_value(param_type: str, default_value: str):
    normalized_type = str(param_type or "string").strip().lower()
    raw_value = default_value if default_value is not None else ""
    if normalized_type in {"number", "int", "float"}:
        try:
            if "." in str(raw_value):
                return float(str(raw_value))
            return int(str(raw_value))
        except Exception:
            return raw_value

    if normalized_type in {"bool", "boolean"}:
        token = str(raw_value).strip().lower()
        return token in {"1", "true", "yes", "on"}

    if normalized_type in {"json", "list", "object", "dict"}:
        if not str(raw_value).strip():
            return [] if normalized_type == "list" else {}
        try:
            return json.loads(str(raw_value))
        except Exception:
            return raw_value

    return raw_value


def _step_script_items(step: dict) -> list[dict]:
    step_id = int(step.get("id") or 0)
    if step_id <= 0:
        return []

    items = list_step_items(step_id, active_only=True)
    return [item for item in items if str(item.get("item_type") or "").strip().lower() == "script"]


def _step_active_items(step: dict) -> list[dict]:
    step_id = int(step.get("id") or 0)
    if step_id <= 0:
        return []

    return list_step_items(step_id, active_only=True)


def _resolve_script_item(step: dict, action_key: str) -> dict | None:
    action = _normalize_action(action_key)
    if not action:
        return None

    for item in _step_script_items(step):
        if _normalize_action(item.get("item_key")) == action:
            return item
    return None


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


def _payload_get_key(node) -> str:
    if not (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "get"):
        return ""

    if not node.args:
        return ""

    return _node_str_key(node.args[0])


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
            target_names: list[str] = []
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


def _load_script_source(item_id: int, script_path: str = "") -> str:
    direct_path = str(script_path or "").strip()
    if direct_path:
        try:
            with open(os.path.abspath(direct_path), "r", encoding="utf-8") as handle:
                direct_source = handle.read()
            if direct_source.strip():
                return direct_source
        except Exception:
            pass

    payload = get_step_item_script_content(int(item_id))
    content = str(payload.get("content") or "")
    if content.strip():
        return content

    item = payload.get("item") or {}
    script_path = str(item.get("script_path") or "").strip()
    if not script_path:
        return ""

    try:
        with open(script_path, "r", encoding="utf-8") as handle:
            return handle.read()
    except Exception:
        return ""


def _infer_parameter_schema_from_script(item_id: int, script_path: str = "") -> list[dict]:
    source = _load_script_source(item_id, script_path)
    if not source.strip():
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


def _build_parameter_schema(item_id: int, item_type: str = "script", script_path: str = "") -> list[dict]:
    rows = list_step_item_parameters(int(item_id))
    schema: list[dict] = []
    for row in rows:
        schema.append(
            {
                "key": row.get("param_key"),
                "label": row.get("label") or row.get("param_key"),
                "type": row.get("param_type") or "string",
                "required": bool(row.get("is_required")),
                "default": _coerce_default_value(row.get("param_type"), row.get("default_value")),
                "sort_order": int(row.get("sort_order") or 100),
            }
        )

    if schema:
        return schema

    if str(item_type or "").strip().lower() != "script":
        return []

    return _infer_parameter_schema_from_script(int(item_id), script_path)


def _default_parameters_from_schema(schema: list[dict]) -> dict:
    defaults: dict = {}
    for item in schema:
        key = str(item.get("key") or "").strip()
        if not key:
            continue
        defaults[key] = item.get("default")
    return defaults


def _build_ai_guidance(*, step: dict, action_key: str, target: str, process_logs: list[str], script_result) -> dict:
    last_log = process_logs[-1] if process_logs else ""
    success = bool(isinstance(script_result, dict) and script_result.get("ok", False))
    next_stage = {
        "scan": "attack",
        "attack": "remediation",
        "remediation": "remediation",
    }.get(str(step.get("workflow_key") or "scan").strip().lower(), "remediation")

    hint_lines = [
        f"Step: {step.get('step_name') or step.get('step_key')}",
        f"Action: {action_key}",
        f"Target: {target}",
        f"Success: {'yes' if success else 'no'}",
        f"Last log: {last_log or '-'}",
        f"Next suggested stage: {next_stage}",
    ]

    return {
        "template_version": _SCRIPT_TEMPLATE_VERSION,
        "success": success,
        "next_stage": next_stage,
        "summary": "\n".join(hint_lines),
        "context_for_ai": {
            "step_key": step.get("step_key"),
            "step_name": step.get("step_name"),
            "workflow_key": step.get("workflow_key"),
            "action": action_key,
            "target": target,
            "log_count": len(process_logs),
            "last_log": last_log,
            "script_result": script_result,
        },
    }


def _validation_action_step_key(step: dict) -> str:
    raw = str(step.get("step_key") or "scan").strip().lower()
    if len(raw) <= 32:
        return raw

    workflow = str(step.get("workflow_key") or "scan").strip().lower()[:10] or "scan"
    step_id = str(step.get("id") or "0").strip()[:8] or "0"
    digest = hashlib.sha1(raw.encode("utf-8")).hexdigest()[:10]
    compact = f"{workflow}_{step_id}_{digest}"
    return compact[:32]


def _run_script_execution_job(
    *,
    execution_id: str,
    step: dict,
    script_item: dict,
    action_key: str,
    target: str,
    reason: str,
    parameters: dict,
    current_user: dict,
) -> None:
    set_status(execution_id, "running", "script starting")
    append_log(execution_id, f"script start: {script_item.get('display_name') or action_key}")

    process_logs: list[str] = []
    script_result = None
    timeout_sec = int(os.getenv("SSVP_SCRIPT_EXEC_TIMEOUT_SEC", "300") or "300")

    try:
        script_payload = get_step_item_script_content(int(script_item.get("id") or 0))
        script_path = str((script_payload.get("item") or {}).get("script_path") or "").strip()
        if not script_path:
            raise RuntimeError("Script dosya yolu tanimli degil.")

        runtime_input = {
            "template_version": _SCRIPT_TEMPLATE_VERSION,
            "target": target,
            "parameters": parameters,
            "step": {
                "step_key": step.get("step_key"),
                "step_name": step.get("step_name"),
                "workflow_key": step.get("workflow_key"),
            },
            "action": {
                "key": action_key,
                "item_key": script_item.get("item_key"),
                "display_name": script_item.get("display_name"),
                "description": script_item.get("description"),
            },
        }

        env = os.environ.copy()
        env["PYTHONUNBUFFERED"] = "1"
        env["SSVP_INPUT_JSON"] = json.dumps(runtime_input, ensure_ascii=False)

        process = subprocess.Popen(
            [sys.executable, script_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            env=env,
        )

        start_time = time.time()
        while True:
            if process.stdout is None:
                break

            raw_line = process.stdout.readline()
            if raw_line:
                line = raw_line.rstrip("\n").strip()
                if line:
                    if line.startswith("SSVP_RESULT_JSON:"):
                        raw_result = line.split("SSVP_RESULT_JSON:", 1)[1].strip()
                        try:
                            script_result = json.loads(raw_result)
                        except Exception:
                            script_result = {"ok": False, "error": "Script result JSON parse failed", "raw": raw_result}
                    else:
                        process_logs.append(line)
                        append_log(execution_id, line)

            if process.poll() is not None:
                break

            if time.time() - start_time > timeout_sec:
                process.kill()
                raise TimeoutError(f"Script timeout ({timeout_sec}s)")

            time.sleep(0.05)

        return_code = int(process.wait(timeout=5))
        if script_result is None:
            script_result = {
                "ok": return_code == 0,
                "exit_code": return_code,
                "message": "Script completed" if return_code == 0 else "Script failed",
            }

        ai_guidance = _build_ai_guidance(
            step=step,
            action_key=action_key,
            target=target,
            process_logs=process_logs,
            script_result=script_result,
        )

        run_status = "success" if bool(script_result.get("ok", return_code == 0)) else "failed"
        safe_step_key = _validation_action_step_key(step)

        create_validation_action(
            step_id=int(step.get("id") or 0),
            step_key=safe_step_key,
            step_name=str(step.get("step_name") or step.get("step_key") or "Step"),
            action_key=action_key,
            target=target,
            reason=reason,
            parameters=parameters,
            created_by=int(current_user.get("id")) if current_user.get("id") else None,
            tool_run_id=None,
            evidence={
                "template_version": _SCRIPT_TEMPLATE_VERSION,
                "process_logs": process_logs,
                "result": script_result,
                "exit_code": int(script_result.get("exit_code", 0) or 0),
            },
            ai_analysis=ai_guidance,
            status=run_status,
        )

        set_result(
            execution_id,
            {
                "status": run_status,
                "output": {
                    "template_version": _SCRIPT_TEMPLATE_VERSION,
                    "process_logs": process_logs,
                    "result": script_result,
                    "ai_guidance": ai_guidance,
                },
            },
        )
        set_status(execution_id, "finished", "script completed")
    except Exception as exc:
        error_text = str(exc) or "Script execution failed"
        append_log(execution_id, f"error: {error_text}")
        set_error(execution_id, error_text)
        set_result(
            execution_id,
            {
                "status": "failed",
                "output": {
                    "template_version": _SCRIPT_TEMPLATE_VERSION,
                    "process_logs": process_logs,
                    "result": script_result or {"ok": False, "error": error_text},
                    "ai_guidance": {
                        "template_version": _SCRIPT_TEMPLATE_VERSION,
                        "success": False,
                        "next_stage": "remediation",
                        "summary": f"Execution failed: {error_text}",
                        "context_for_ai": {
                            "step_key": step.get("step_key"),
                            "action": action_key,
                            "target": target,
                            "error": error_text,
                        },
                    },
                },
            },
        )
        set_status(execution_id, "failed", "script failed")


class WorkflowStepSuggestionRequest(BaseModel):
    step_key: str = Field(min_length=2, max_length=80)
    target: str = Field(min_length=1, max_length=255)
    scan_tool: str = Field(default="nmap", min_length=1, max_length=64)
    scan_result: dict = Field(default_factory=dict)
    evidence: list[dict] = Field(default_factory=list)


class ResolveIntentRequest(BaseModel):
    step_key: str = Field(min_length=2, max_length=80)
    action: str = Field(min_length=2, max_length=120)
    target: str = Field(min_length=1, max_length=255)
    reason: str = Field(min_length=3, max_length=2000)
    parameters: dict = Field(default_factory=dict)


class ExecuteIntentRequest(BaseModel):
    step_key: str = Field(min_length=2, max_length=80)
    action: str = Field(min_length=2, max_length=120)
    target: str = Field(min_length=1, max_length=255)
    reason: str = Field(min_length=3, max_length=2000)
    parameters: dict = Field(default_factory=dict)
    approved: bool = False


class EvidenceAnalysisRequest(BaseModel):
    target: str = Field(min_length=1, max_length=255)
    evidence: list[dict] = Field(default_factory=list)


def _require_step(step_key: str, language: str) -> dict:
    step = get_workflow_step(step_key)
    if not step or not step.get("is_active"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=t(language, "validation.invalidStage", "Gecersiz validation asamasi"),
        )
    return step


def _ensure_step_access(step: dict, current_user: dict, language: str) -> None:
    role_required = (step.get("role_required") or "test").strip().lower()
    user_roles = set(current_user.get("roles") or [])

    if current_user.get("is_admin"):
        return

    if role_required and role_required not in user_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=t(language, "auth.insufficientPermissions", "Yetersiz yetki"),
        )


@router.get("/validation/workflow-steps")
def validation_workflow_steps(current_user: dict = Depends(require_roles(ROLE_TEST, ROLE_REMEDIATION, ROLE_ATTACK))):
    steps = list_workflow_steps(active_only=True)
    if current_user.get("is_admin"):
        return {"items": steps}

    user_roles = set(current_user.get("roles") or [])
    allowed_steps = []
    for step in steps:
        role_required = (step.get("role_required") or "test").strip().lower()
        if not role_required or role_required in user_roles:
            allowed_steps.append(step)

    return {"items": allowed_steps}


@router.post("/validation/step-intents")
def validation_step_intents(
    request: Request,
    payload: WorkflowStepSuggestionRequest,
    current_user: dict = Depends(require_roles(ROLE_TEST, ROLE_REMEDIATION, ROLE_ATTACK)),
):
    language = request_lang(request)
    step = _require_step(payload.step_key, language)
    _ensure_step_access(step, current_user, language)

    scan_result = dict(payload.scan_result or {})
    scan_result["target"] = payload.target
    scan_result["scan_tool"] = payload.scan_tool
    scan_result["evidence"] = payload.evidence
    scan_result["workflow_step"] = {
        "step_key": step["step_key"],
        "step_name": step["step_name"],
        "workflow_key": step.get("workflow_key") or "scan",
        "description": step.get("description", ""),
        "ai_prompt_hint": step.get("ai_prompt_hint", ""),
    }

    step_workflow_key = (step.get("workflow_key") or "scan").strip().lower()
    step_items = _step_active_items(step)
    allowed_actions = [_normalize_action(item.get("item_key")) for item in step_items if _normalize_action(item.get("item_key"))]

    stage_tools: list[dict] = []
    for item in step_items:
        stage_tools.append(
            {
                "action": _normalize_action(item.get("item_key")),
                "label": item.get("display_name") or item.get("item_key"),
                "description": item.get("description") or "",
                "item_type": str(item.get("item_type") or "script").strip().lower(),
            }
        )
    scan_result["stage_tools"] = stage_tools

    ai_payload = suggest_action_intents(
        scan_result,
        stage=step_workflow_key,
        language=language,
        allowed_actions=allowed_actions,
    )

    ai_action_map = {
        _normalize_action(item.get("action")): item
        for item in (ai_payload.get("actions") or [])
        if _normalize_action(item.get("action"))
    }
    recommended_action = ""
    for action_item in (ai_payload.get("actions") or []):
        normalized = _normalize_action(action_item.get("action"))
        if normalized and normalized in ai_action_map:
            recommended_action = normalized
            break

    intents = []
    for item in step_items:
        action_key = _normalize_action(item.get("item_key"))
        if not action_key:
            continue

        item_type = str(item.get("item_type") or "script").strip().lower()
        schema = _build_parameter_schema(
            int(item.get("id") or 0),
            item_type,
            str(item.get("script_path") or "").strip(),
        )
        defaults = _default_parameters_from_schema(schema)
        ai_match = ai_action_map.get(action_key) or {}
        ai_params = ai_match.get("parameters") if isinstance(ai_match.get("parameters"), dict) else {}
        merged_params = {**defaults, **ai_params}

        intents.append(
            {
                "action": action_key,
                "target": str(ai_match.get("target") or payload.target).strip(),
                "reason": str(ai_match.get("reason") or item.get("description") or "Script dogrulama aksiyonu").strip(),
                "parameters": merged_params,
                "parameter_schema": schema,
                "item_type": item_type,
                "executable": item_type == "script",
                "template_version": _SCRIPT_TEMPLATE_VERSION,
                "script": {
                    "item_id": int(item.get("id") or 0),
                    "display_name": item.get("display_name") or item.get("item_key"),
                    "item_type": item_type,
                },
            }
        )

    return {
        "step": step,
        "summary": ai_payload.get("summary") or "Script bazli aksiyon listesi yuklendi.",
        "recommended_action": recommended_action,
        "intents": intents,
        "template": {
            "version": _SCRIPT_TEMPLATE_VERSION,
            "log_channel": "process_logs",
            "result_channel": "result",
            "ai_guidance_channel": "ai_guidance",
        },
    }


@router.post("/validation/resolve-intent")
def validation_resolve_intent(
    request: Request,
    payload: ResolveIntentRequest,
    current_user: dict = Depends(require_roles(ROLE_TEST, ROLE_REMEDIATION, ROLE_ATTACK)),
):
    language = request_lang(request)
    step = _require_step(payload.step_key, language)
    _ensure_step_access(step, current_user, language)

    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail=t(language, "validation.commandSystemRemoved", "Gorev/komut sistemi kaldirildi"),
    )


@router.post("/validation/execute-intent")
def validation_execute_intent(
    background_tasks: BackgroundTasks,
    request: Request,
    payload: ExecuteIntentRequest,
    current_user: dict = Depends(require_roles(ROLE_TEST, ROLE_REMEDIATION, ROLE_ATTACK)),
):
    language = request_lang(request)
    step = _require_step(payload.step_key, language)
    _ensure_step_access(step, current_user, language)

    if not payload.approved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=t(language, "validation.approvalRequired", "Islem calistirmak icin onay gerekli"),
        )

    script_item = _resolve_script_item(step, payload.action)
    if not script_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=t(language, "validation.invalidAction", "Secilen action bu asama icin tanimli degil"),
        )

    execution_id = create_execution(
        step_key=payload.step_key,
        action=payload.action,
        target=payload.target,
        created_by=int(current_user.get("id")) if current_user.get("id") else None,
    )

    append_log(execution_id, "execution queued")
    background_tasks.add_task(
        _run_script_execution_job,
        execution_id=execution_id,
        step=step,
        script_item=script_item,
        action_key=_normalize_action(payload.action),
        target=payload.target,
        reason=payload.reason,
        parameters=payload.parameters if isinstance(payload.parameters, dict) else {},
        current_user=current_user,
    )

    return {
        "execution_id": execution_id,
        "status": "queued",
        "template_version": _SCRIPT_TEMPLATE_VERSION,
    }


@router.get("/validation/executions/{execution_id}")
def validation_execution_status(
    execution_id: str,
    current_user: dict = Depends(require_roles(ROLE_TEST, ROLE_REMEDIATION, ROLE_ATTACK)),
):
    del current_user
    item = get_execution(execution_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Execution not found")
    return item


@router.post("/validation/evidence-analysis")
def validation_evidence_analysis(
    request: Request,
    payload: EvidenceAnalysisRequest,
    current_user: dict = Depends(require_roles(ROLE_TEST, ROLE_REMEDIATION, ROLE_ATTACK)),
):
    del current_user
    language = request_lang(request)

    if payload.evidence:
        evidence = payload.evidence
    else:
        evidence = [item for item in list_validation_actions(target=payload.target) if item.get("evidence")]

    analysis = analyze_evidence_with_ai(target=payload.target, evidence=evidence, language=language)

    return {
        "target": payload.target,
        "analysis": analysis,
        "evidence_count": len(evidence),
    }


@router.get("/validation/actions")
def validation_actions(target: str | None = None, current_user: dict = Depends(require_roles(ROLE_TEST, ROLE_REMEDIATION, ROLE_ATTACK))):
    del current_user
    return {"items": list_validation_actions(target=target)}
