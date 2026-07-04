import json

from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, HTTPException, Request, status

from backend.ai.ollama_client import analyze_evidence_with_ai, suggest_action_intents
from backend.auth import require_roles
from backend.i18n import request_lang, t
from backend.services.auth_store import ROLE_REMEDIATION, ROLE_TEST
from backend.services.orchestrator_store import (
    create_validation_action,
    get_tool_with_parameters,
    get_workflow_step,
    list_validation_actions,
    list_workflow_steps,
)
from backend.tools.models import ActionIntent
from backend.tools.runner import execute_action_intent


router = APIRouter()


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
def validation_workflow_steps(current_user: dict = Depends(require_roles(ROLE_TEST, ROLE_REMEDIATION))):
    del current_user
    return {"items": list_workflow_steps(active_only=True)}


@router.post("/validation/step-intents")
def validation_step_intents(
    request: Request,
    payload: WorkflowStepSuggestionRequest,
    current_user: dict = Depends(require_roles(ROLE_TEST, ROLE_REMEDIATION)),
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
        "description": step.get("description", ""),
        "ai_prompt_hint": step.get("ai_prompt_hint", ""),
    }

    ai_payload = suggest_action_intents(scan_result, stage=step["step_key"], language=language)

    intents = []
    for item in ai_payload.get("actions") or []:
        action_key = str(item.get("action") or "").strip().lower()
        tool_info = get_tool_with_parameters(action_key)
        intents.append(
            {
                "action": action_key,
                "target": str(item.get("target") or payload.target).strip(),
                "reason": str(item.get("reason") or "").strip(),
                "parameters": item.get("parameters") if isinstance(item.get("parameters"), dict) else {},
                "tool": tool_info,
            }
        )

    return {
        "step": step,
        "summary": ai_payload.get("summary") or "",
        "intents": intents,
    }


@router.post("/validation/resolve-intent")
def validation_resolve_intent(
    request: Request,
    payload: ResolveIntentRequest,
    current_user: dict = Depends(require_roles(ROLE_TEST, ROLE_REMEDIATION)),
):
    language = request_lang(request)
    step = _require_step(payload.step_key, language)
    _ensure_step_access(step, current_user, language)

    tool = get_tool_with_parameters(payload.action)
    if not tool or not tool.get("is_active"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=t(language, "scan.route.invalidTool", "Geçersiz tarama aracı seçildi."),
        )

    resolved_parameters: dict = {}
    provided = payload.parameters or {}
    for item in tool.get("parameters") or []:
        key = item.get("param_key")
        default_value = item.get("default_value", "")
        parsed_default = default_value
        if item.get("param_type") in {"list", "json", "object"}:
            try:
                if default_value:
                    parsed_default = json.loads(default_value)
                else:
                    parsed_default = [] if item.get("param_type") == "list" else {}
            except Exception:
                parsed_default = [] if item.get("param_type") == "list" else {}

        resolved_parameters[key] = provided.get(key, parsed_default)

    return {
        "step": step,
        "intent": {
            "action": payload.action.strip().lower(),
            "target": payload.target.strip(),
            "reason": payload.reason.strip(),
            "parameters": resolved_parameters,
        },
        "tool": tool,
    }


@router.post("/validation/execute-intent")
def validation_execute_intent(
    request: Request,
    payload: ExecuteIntentRequest,
    current_user: dict = Depends(require_roles(ROLE_TEST, ROLE_REMEDIATION)),
):
    language = request_lang(request)
    step = _require_step(payload.step_key, language)
    _ensure_step_access(step, current_user, language)

    intent = ActionIntent(
        action=payload.action,
        target=payload.target,
        reason=payload.reason,
        parameters=payload.parameters,
    )

    result = execute_action_intent(
        intent=intent,
        approved=payload.approved,
        requested_by=int(current_user.get("id")) if current_user.get("id") is not None else None,
        language=language,
    )

    action_id = create_validation_action(
        step_id=int(step["id"]),
        action_key=payload.action,
        target=payload.target,
        reason=payload.reason,
        parameters=payload.parameters,
        created_by=int(current_user.get("id")) if current_user.get("id") is not None else None,
        tool_run_id=result.get("run_id"),
        evidence=result.get("output") if isinstance(result.get("output"), dict) else {},
        ai_analysis={},
        status=result.get("status") or "planned",
    )

    return {
        "ok": bool(result.get("ok")),
        "step": step,
        "validation_action_id": action_id,
        "result": result,
    }


@router.post("/validation/evidence-analysis")
def validation_evidence_analysis(
    request: Request,
    payload: EvidenceAnalysisRequest,
    current_user: dict = Depends(require_roles(ROLE_TEST, ROLE_REMEDIATION)),
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
def validation_actions(target: str | None = None, current_user: dict = Depends(require_roles(ROLE_TEST, ROLE_REMEDIATION))):
    del current_user
    return {"items": list_validation_actions(target=target)}
