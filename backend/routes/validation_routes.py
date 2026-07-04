from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, HTTPException, Request, status

from backend.ai.ollama_client import suggest_action_intents
from backend.auth import require_roles
from backend.i18n import request_lang, t
from backend.services.auth_store import ROLE_REMEDIATION, ROLE_TEST
from backend.services.tool_registry_store import get_tool_action, list_tool_actions
from backend.tools.models import ActionIntent
from backend.tools.runner import execute_action_intent


router = APIRouter()
_ALLOWED_STAGES = {"validation_plan", "evidence_risk_analysis", "remediation_plan"}


class ValidationStageSuggestionRequest(BaseModel):
    stage: str = Field(min_length=3, max_length=64)
    target: str = Field(min_length=1, max_length=255)
    scan_tool: str = Field(default="nmap", min_length=1, max_length=64)
    scan_result: dict = Field(default_factory=dict)


class ValidationExecuteRequest(BaseModel):
    stage: str = Field(min_length=3, max_length=64)
    action: str = Field(min_length=2, max_length=120)
    target: str = Field(min_length=1, max_length=255)
    reason: str = Field(min_length=3, max_length=2000)
    parameters: dict = Field(default_factory=dict)
    approved: bool = False


def _validate_stage(stage_value: str, language: str) -> str:
    stage = stage_value.strip().lower()
    if stage not in _ALLOWED_STAGES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=t(language, "validation.invalidStage", "Gecersiz validation asamasi"),
        )
    return stage


def _enrich_intent_with_registry(intent_item: dict) -> dict:
    action_key = str(intent_item.get("action") or "").strip().lower()
    registry_item = get_tool_action(action_key)

    return {
        "action": action_key,
        "target": str(intent_item.get("target") or "").strip(),
        "reason": str(intent_item.get("reason") or "").strip(),
        "parameters": intent_item.get("parameters") if isinstance(intent_item.get("parameters"), dict) else {},
        "tool": {
            "exists": bool(registry_item),
            "tool_name": registry_item.get("tool_name") if registry_item else None,
            "risk_level": registry_item.get("risk_level") if registry_item else None,
            "requires_approval": bool(registry_item.get("requires_approval")) if registry_item else False,
            "default_params": registry_item.get("default_params") if registry_item else {},
        },
    }


@router.get("/validation/tool-actions")
def validation_tool_actions(current_user: dict = Depends(require_roles(ROLE_TEST))):
    del current_user
    return {"items": list_tool_actions(active_only=True)}


@router.post("/validation/stage-suggestion")
def validation_stage_suggestion(
    request: Request,
    payload: ValidationStageSuggestionRequest,
    current_user: dict = Depends(require_roles(ROLE_TEST)),
):
    del current_user
    language = request_lang(request)
    stage = _validate_stage(payload.stage, language)

    scan_result = dict(payload.scan_result or {})
    scan_result["target"] = payload.target
    scan_result["scan_tool"] = payload.scan_tool

    ai_payload = suggest_action_intents(scan_result, stage=stage, language=language)
    intents = [_enrich_intent_with_registry(item) for item in ai_payload.get("actions") or []]

    return {
        "stage": stage,
        "summary": ai_payload.get("summary") or "",
        "intents": intents,
    }


@router.post("/validation/execute")
def validation_execute(
    request: Request,
    payload: ValidationExecuteRequest,
    current_user: dict = Depends(require_roles(ROLE_TEST, ROLE_REMEDIATION)),
):
    language = request_lang(request)
    stage = _validate_stage(payload.stage, language)

    if stage == "remediation_plan" and ROLE_REMEDIATION not in set(current_user.get("roles") or []):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=t(language, "auth.insufficientPermissions", "Yetersiz yetki"),
        )

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

    if result.get("status") == "approval_required":
        return {
            "ok": False,
            "stage": stage,
            "approval_required": True,
            "result": result,
            "message": t(language, "validation.approvalRequired", "Bu action icin kullanici onayi gerekli"),
        }

    return {
        "ok": bool(result.get("ok")),
        "stage": stage,
        "approval_required": bool(result.get("approval_required")),
        "result": result,
    }
