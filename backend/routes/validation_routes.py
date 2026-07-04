import json
import os
import queue
import subprocess
import sys
import threading
import time
import hashlib

from pydantic import BaseModel, Field

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status

from backend.ai.ollama_client import (
    analyze_evidence_with_ai,
    evaluate_script_result,
    orchestrate_next_operation,
    suggest_action_intents,
)
from backend.auth import require_roles
from backend.i18n import request_lang, t
from backend.services.auth_store import ROLE_ATTACK, ROLE_REMEDIATION, ROLE_TEST
from backend.services.param_inference import infer_parameter_schema
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
    clear_process,
    create_execution,
    get_execution,
    is_cancel_requested,
    register_process,
    request_stop,
    set_error,
    set_result,
    set_status,
)


router = APIRouter()

_SCRIPT_TEMPLATE_VERSION = "SSVP_SCRIPT_TEMPLATE_V1"


class _ExecutionCancelled(Exception):
    """Raised inside a run job when the user requested the execution stop."""

# Parameter keys whose values can be carried forward from prior stage results.
_PREFILL_FACT_KEYS = (
    "ports", "open_ports", "scan_ports", "hosts", "live_hosts",
    "endpoints", "api_endpoints", "urls", "login_paths", "services",
)


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

    try:
        payload = get_step_item_script_content(int(item_id))
    except Exception:
        # Non-script items (tasks) or missing files have no inferable source.
        return ""
    # get_step_item_script_content returns the source under "script_source".
    source = str(payload.get("script_source") or payload.get("content") or "")
    if source.strip():
        return source

    item = payload.get("item") or {}
    fallback_path = str(item.get("script_path") or "").strip()
    if not fallback_path:
        return ""

    try:
        with open(fallback_path, "r", encoding="utf-8") as handle:
            return handle.read()
    except Exception:
        return ""


def _infer_parameter_schema_from_script(item_id: int, script_path: str = "") -> list[dict]:
    source = _load_script_source(item_id, script_path)
    return infer_parameter_schema(source)


def _build_parameter_schema(item_id: int, item_type: str = "script", script_path: str = "") -> list[dict]:
    """Build the parameter schema for a step item.

    Priority: explicit DB-defined parameters first (admin curated); then any
    parameters auto-detected from the script source that were not already
    covered. This is what makes freshly uploaded scripts expose their inputs
    without manual configuration.
    """
    rows = list_step_item_parameters(int(item_id))
    schema: list[dict] = []
    known_keys: set[str] = set()
    for row in rows:
        key = str(row.get("param_key") or "").strip()
        if not key:
            continue
        known_keys.add(key)
        schema.append(
            {
                "key": key,
                "label": row.get("label") or key,
                "type": row.get("param_type") or "string",
                "required": bool(row.get("is_required")),
                "default": _coerce_default_value(row.get("param_type"), row.get("default_value")),
                "description": row.get("description") or "",
                "options_json": row.get("options_json") if isinstance(row.get("options_json"), (list, dict)) else [],
                "sort_order": int(row.get("sort_order") or 100),
                "source": "registry",
            }
        )

    if str(item_type or "script").strip().lower() != "script":
        return schema

    next_order = max([int(item.get("sort_order") or 0) for item in schema], default=0) + 10
    for candidate in _infer_parameter_schema_from_script(int(item_id), script_path):
        key = str(candidate.get("key") or "").strip()
        if not key or key in known_keys:
            continue
        known_keys.add(key)
        schema.append(
            {
                "key": key,
                "label": candidate.get("label") or key,
                "type": candidate.get("type") or "string",
                "required": bool(candidate.get("required")),
                "default": candidate.get("default"),
                "description": "",
                "options_json": [],
                "sort_order": next_order,
                "source": "auto_detected",
            }
        )
        next_order += 10

    return schema


def _collect_prefill_from_prior(target: str) -> tuple[dict, dict]:
    """Gather known values for a target from prior validation actions.

    Returns (values_by_key, source_by_key). Used so a new operation stage is
    pre-populated with data already in hand (previously entered parameters and
    facts discovered by earlier scripts), which the user can still edit.
    """
    values: dict = {}
    source: dict = {}
    try:
        actions = list_validation_actions(target=target)
    except Exception:
        return values, source

    # list_validation_actions returns newest-first; walk oldest-first so the
    # most recent value for a repeated key wins.
    for action in reversed(actions):
        params = action.get("parameters") if isinstance(action.get("parameters"), dict) else {}
        for key, value in params.items():
            if value in (None, "", [], {}):
                continue
            values[key] = value
            source[key] = "previous_input"

        evidence = action.get("evidence") if isinstance(action.get("evidence"), dict) else {}
        result = evidence.get("result") if isinstance(evidence.get("result"), dict) else {}
        for fact_key in _PREFILL_FACT_KEYS:
            fact_value = result.get(fact_key)
            if fact_value in (None, "", [], {}):
                continue
            values[fact_key] = fact_value
            source[fact_key] = "prior_result"

    return values, source


def _default_parameters_from_schema(schema: list[dict]) -> dict:
    defaults: dict = {}
    for item in schema:
        key = str(item.get("key") or "").strip()
        if not key:
            continue
        defaults[key] = item.get("default")
    return defaults


def _user_can_access_step(step: dict, current_user: dict) -> bool:
    if current_user.get("is_admin"):
        return True
    role_required = (step.get("role_required") or "test").strip().lower()
    if not role_required:
        return True
    return role_required in set(current_user.get("roles") or [])


def _build_action_catalog(current_user: dict) -> tuple[list[dict], dict]:
    """Enumerate every executable script action the user may run, by stage.

    Returns (catalog, index) where catalog is a JSON-friendly list of
    {stage, step_key, action, display_name, description} for the AI prompt, and
    index maps action_key -> {stage, step, item} for building executable intents.
    """
    catalog: list[dict] = []
    index: dict = {}
    for step in list_workflow_steps(active_only=True):
        if not _user_can_access_step(step, current_user):
            continue
        stage = str(step.get("workflow_key") or "scan").strip().lower()
        for item in _step_script_items(step):
            action = _normalize_action(item.get("item_key"))
            if not action or action in index:
                continue
            catalog.append(
                {
                    "stage": stage,
                    "step_key": step.get("step_key"),
                    "action": action,
                    "display_name": item.get("display_name") or item.get("item_key"),
                    "description": item.get("description") or "",
                }
            )
            index[action] = {"stage": stage, "step": step, "item": item}
    return catalog, index


def _build_orchestration_history(target: str, stage_by_action: dict) -> list[dict]:
    """Compact, AI-friendly summary of what already ran for a target."""
    history: list[dict] = []
    try:
        actions = list_validation_actions(target=target)
    except Exception:
        return history

    for action in actions[:20]:
        ai = action.get("ai_analysis") if isinstance(action.get("ai_analysis"), dict) else {}
        evaluation = ai.get("evaluation") if isinstance(ai.get("evaluation"), dict) else {}
        evidence = action.get("evidence") if isinstance(action.get("evidence"), dict) else {}
        result = evidence.get("result") if isinstance(evidence.get("result"), dict) else {}
        action_key = _normalize_action(action.get("action_key"))
        result_facts = {
            key: result.get(key)
            for key in _PREFILL_FACT_KEYS
            if result.get(key) not in (None, "", [], {})
        }
        history.append(
            {
                "action": action_key,
                "stage": stage_by_action.get(action_key, ""),
                "status": action.get("status") or "unknown",
                "risk_level": ai.get("risk_level") or evaluation.get("risk_level") or "",
                "summary": str(ai.get("summary") or evaluation.get("summary") or "")[:280],
                "result_facts": result_facts,
            }
        )

    history.reverse()  # oldest-first reads more naturally for the model
    return history


_SMART_URL_KEYS = {"url", "base_url", "target_url", "login_endpoint", "endpoint", "target_uri"}
_SMART_HOST_KEYS = {"host", "target_host", "rhost", "rhosts", "ip", "target_ip", "hosts", "target"}


def _target_as_url(target: str) -> str:
    token = str(target or "").strip()
    if not token:
        return ""
    if token.startswith("http://") or token.startswith("https://"):
        return token
    return "http://" + token


def _apply_smart_defaults(schema: list[dict], params: dict, target: str) -> dict:
    """Fill still-empty params with sensible values derived from the target.

    Runs after registry defaults / AI suggestions / prior-data prefill, so it
    only touches keys nothing else populated. Keeps required host/URL inputs from
    landing on the user empty (Requirement: auto-fill sensible values).
    """
    for field in schema:
        key = str(field.get("key") or "").strip()
        if not key:
            continue
        value = params.get(key)
        if value not in (None, "", [], {}):
            continue
        low = key.lower()
        if low in _SMART_URL_KEYS:
            params[key] = _target_as_url(target)
        elif low in _SMART_HOST_KEYS:
            params[key] = str(target or "").strip()
    return params


def _intent_from_item(
    step: dict,
    item: dict,
    target: str,
    prior_values: dict,
    prior_sources: dict,
    ai_params: dict,
    reason_override: str = "",
) -> dict:
    """Build an executable intent (schema + prefilled params) for one script item."""
    action_key = _normalize_action(item.get("item_key"))
    item_type = str(item.get("item_type") or "script").strip().lower()
    schema = _build_parameter_schema(
        int(item.get("id") or 0),
        item_type,
        str(item.get("script_path") or "").strip(),
    )
    defaults = _default_parameters_from_schema(schema)
    ai_params = ai_params if isinstance(ai_params, dict) else {}
    schema_keys = {str(field.get("key") or "").strip() for field in schema}
    prefill = {key: value for key, value in prior_values.items() if key in schema_keys}
    prefill_meta = {key: prior_sources.get(key, "prior_result") for key in prefill}
    ai_filtered = {key: value for key, value in ai_params.items() if key in schema_keys}
    merged_params = {**defaults, **ai_filtered, **prefill}
    merged_params = _apply_smart_defaults(schema, merged_params, target)

    return {
        "action": action_key,
        "step_key": step.get("step_key"),
        "target": str(target).strip(),
        "reason": str(reason_override or item.get("description") or "Script dogrulama aksiyonu").strip(),
        "parameters": merged_params,
        "parameter_schema": schema,
        "prefill": prefill,
        "prefill_sources": prefill_meta,
        "item_type": item_type,
        "executable": item_type == "script",
        "template_version": _SCRIPT_TEMPLATE_VERSION,
        "script": {
            "item_id": int(item.get("id") or 0),
            "display_name": item.get("display_name") or item.get("item_key"),
            "item_type": item_type,
        },
    }


def _build_ai_guidance(*, step: dict, action_key: str, target: str, process_logs: list[str], script_result, language: str = "tr") -> dict:
    last_log = process_logs[-1] if process_logs else ""
    success = bool(isinstance(script_result, dict) and script_result.get("ok", False))
    default_next = {
        "scan": "attack",
        "attack": "remediation",
        "remediation": "remediation",
    }.get(str(step.get("workflow_key") or "scan").strip().lower(), "remediation")

    # Real AI assessment of what the script produced (never raises: has fallback).
    evaluation = evaluate_script_result(
        step=step,
        action_key=action_key,
        target=target,
        process_logs=process_logs,
        script_result=script_result if isinstance(script_result, dict) else {"raw": script_result},
        language=language,
    )

    summary = evaluation.get("summary") or ""
    if not summary.strip():
        summary = "\n".join(
            [
                f"Step: {step.get('step_name') or step.get('step_key')}",
                f"Action: {action_key}",
                f"Target: {target}",
                f"Success: {'yes' if success else 'no'}",
                f"Last log: {last_log or '-'}",
            ]
        )

    return {
        "template_version": _SCRIPT_TEMPLATE_VERSION,
        "success": bool(evaluation.get("success", success)),
        "risk_level": evaluation.get("risk_level", "low"),
        "next_stage": evaluation.get("next_stage", default_next),
        "summary": summary,
        "evaluation": evaluation,
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

        # A background reader pushes every line onto a queue and signals EOF with
        # a None sentinel. Draining until that sentinel guarantees the final
        # SSVP_RESULT_JSON line is captured even when the script exits instantly
        # (polling process.poll() in the read loop would race past it and lose
        # the result). The queue timeout still lets us enforce the wall-clock
        # limit while the script is silent.
        line_queue: "queue.Queue[str | None]" = queue.Queue()

        def _pump_output(stream) -> None:
            try:
                for raw in iter(stream.readline, ""):
                    line_queue.put(raw)
            finally:
                line_queue.put(None)

        reader = threading.Thread(target=_pump_output, args=(process.stdout,), daemon=True)
        reader.start()
        register_process(execution_id, process)

        start_time = time.time()
        while True:
            if is_cancel_requested(execution_id):
                process.kill()
                raise _ExecutionCancelled()

            try:
                raw_line = line_queue.get(timeout=0.2)
            except queue.Empty:
                if time.time() - start_time > timeout_sec:
                    process.kill()
                    raise TimeoutError(f"Script timeout ({timeout_sec}s)")
                continue

            if raw_line is None:
                break

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

            if time.time() - start_time > timeout_sec:
                process.kill()
                raise TimeoutError(f"Script timeout ({timeout_sec}s)")

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
    except _ExecutionCancelled:
        append_log(execution_id, "execution stopped by user")
        set_result(
            execution_id,
            {
                "status": "cancelled",
                "output": {
                    "template_version": _SCRIPT_TEMPLATE_VERSION,
                    "process_logs": process_logs,
                    "result": script_result or {"ok": False, "cancelled": True},
                    "ai_guidance": {
                        "template_version": _SCRIPT_TEMPLATE_VERSION,
                        "success": False,
                        "next_stage": "remediation",
                        "summary": "Islem kullanici tarafindan durduruldu.",
                        "context_for_ai": {
                            "step_key": step.get("step_key"),
                            "action": action_key,
                            "target": target,
                            "cancelled": True,
                        },
                    },
                },
            },
        )
        set_status(execution_id, "cancelled", "execution stopped")
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
    finally:
        clear_process(execution_id)


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


class OrchestrateRequest(BaseModel):
    target: str = Field(min_length=1, max_length=255)
    user_instruction: str = Field(default="", max_length=2000)
    preferred_stage: str = Field(default="", max_length=32)


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

    prior_values, prior_sources = _collect_prefill_from_prior(payload.target)

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

        # Prefill only keys this action actually understands, using data already
        # in hand. Precedence: schema defaults < AI suggestion < prior data.
        schema_keys = {str(field.get("key") or "").strip() for field in schema}
        prefill = {key: value for key, value in prior_values.items() if key in schema_keys}
        prefill_meta = {key: prior_sources.get(key, "prior_result") for key in prefill}
        merged_params = {**defaults, **ai_params, **prefill}
        merged_params = _apply_smart_defaults(schema, merged_params, payload.target)

        intents.append(
            {
                "action": action_key,
                "target": str(ai_match.get("target") or payload.target).strip(),
                "reason": str(ai_match.get("reason") or item.get("description") or "Script dogrulama aksiyonu").strip(),
                "parameters": merged_params,
                "parameter_schema": schema,
                "prefill": prefill,
                "prefill_sources": prefill_meta,
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


@router.post("/validation/ai-orchestrate")
def validation_ai_orchestrate(
    request: Request,
    payload: OrchestrateRequest,
    current_user: dict = Depends(require_roles(ROLE_TEST, ROLE_REMEDIATION, ROLE_ATTACK)),
):
    """AI-driven loop step: decide the next stage + operations for a target.

    The local LLM picks the next validation operations (from the executable
    catalog the user is allowed to run) and their parameters; the response
    carries fully-formed, prefilled intents so the UI can present them as
    editable inputs for the user to approve, tweak, or redirect.
    """
    language = request_lang(request)

    catalog, index = _build_action_catalog(current_user)
    if not catalog:
        return {
            "stage": "",
            "plan": t(language, "orchestrate.noCatalog", "Calistirilabilir script bulunamadi."),
            "summary": t(language, "orchestrate.noCatalog", "Calistirilabilir script bulunamadi."),
            "done": True,
            "engine": "none",
            "recommended_action": "",
            "intents": [],
            "template": {"version": _SCRIPT_TEMPLATE_VERSION},
        }

    stage_by_action = {entry["action"]: entry["stage"] for entry in catalog}
    history = _build_orchestration_history(payload.target, stage_by_action)

    # The catalog is already role-filtered, so the stages present in it are
    # exactly the ones this user is authorised for. A redirect to any other
    # stage (e.g. a test-only user asking for "attack") is refused here — the AI
    # never even sees it as an option.
    allowed_stages = sorted({entry["stage"] for entry in catalog})
    requested_stage = _normalize_action(payload.preferred_stage)
    role_note = ""
    if requested_stage and requested_stage not in allowed_stages:
        role_note = t(
            language,
            "orchestrate.roleDenied",
            f"'{requested_stage}' asamasi icin yetkiniz yok; bu asama atlandi.",
        )
        requested_stage = ""

    decision = orchestrate_next_operation(
        target=payload.target,
        history=history,
        catalog=catalog,
        user_instruction=payload.user_instruction,
        preferred_stage=requested_stage,
        allowed_stages=allowed_stages,
        language=language,
    )

    prior_values, prior_sources = _collect_prefill_from_prior(payload.target)

    intents: list[dict] = []
    for operation in decision.get("operations") or []:
        action = _normalize_action(operation.get("action"))
        info = index.get(action)
        if not info:
            continue
        intents.append(
            _intent_from_item(
                info["step"],
                info["item"],
                payload.target,
                prior_values,
                prior_sources,
                operation.get("parameters"),
                reason_override=operation.get("reason") or "",
            )
        )

    plan_text = decision.get("plan") or ""
    if role_note:
        plan_text = f"{role_note}\n{plan_text}".strip()

    return {
        "stage": decision.get("stage") or "",
        "plan": plan_text,
        "summary": plan_text,
        "done": bool(decision.get("done")) or not intents,
        "engine": decision.get("engine") or "ai",
        "allowed_stages": allowed_stages,
        "role_note": role_note,
        "recommended_action": intents[0]["action"] if intents else "",
        "intents": intents,
        "template": {
            "version": _SCRIPT_TEMPLATE_VERSION,
            "log_channel": "process_logs",
            "result_channel": "result",
            "ai_guidance_channel": "ai_guidance",
        },
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


@router.post("/validation/executions/{execution_id}/stop")
def validation_execution_stop(
    execution_id: str,
    current_user: dict = Depends(require_roles(ROLE_TEST, ROLE_REMEDIATION, ROLE_ATTACK)),
):
    del current_user
    if not request_stop(execution_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Execution not found")
    return {"execution_id": execution_id, "status": "stopping"}


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
