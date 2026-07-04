import os
import platform
import shutil
import socket
import subprocess
from pathlib import Path

import requests
from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, HTTPException, Request, status

from backend.auth import get_current_user, require_roles
from backend.i18n import request_lang, t
from backend.models.orchestrator_models import (
    ToolCreateRequest,
    ToolParameterCreateRequest,
    ToolParameterUpdateRequest,
    ToolUpdateRequest,
    WorkflowStepCreateRequest,
    WorkflowStepUpdateRequest,
)
from backend.services.orchestrator_store import (
    create_tool,
    create_tool_parameter,
    create_workflow_step,
    list_tool_parameters,
    list_tools,
    list_workflow_steps,
    update_tool,
    update_tool_parameter,
    update_workflow_step,
)
from backend.services.auth_store import (
    VALID_ROLES,
    get_user_by_username,
    update_user,
)
from backend.services.settings_store import get_app_settings, update_app_settings
from backend.services.settings_store import DEFAULT_SETTINGS
from backend.utils.binary_resolver import resolve_binary


router = APIRouter()
PROJECT_VERSION = os.getenv("SSVP_VERSION", "1.0")
PROJECT_VENDOR = os.getenv("SSVP_VENDOR", "SSVP Core Team")


def _bytes_to_gib(value: int) -> float:
    return round(value / (1024 ** 3), 2)


def _read_linux_ram_bytes() -> tuple[int | None, int | None]:
    try:
        lines = Path("/proc/meminfo").read_text(encoding="utf-8").splitlines()
        data: dict[str, int] = {}
        for line in lines:
            if ":" not in line:
                continue
            key, raw_val = line.split(":", maxsplit=1)
            parts = raw_val.strip().split()
            if not parts:
                continue
            # /proc/meminfo values are in KiB
            data[key] = int(parts[0]) * 1024

        total = data.get("MemTotal")
        free = data.get("MemAvailable") or data.get("MemFree")
        return total, free
    except Exception:
        return None, None


def _parse_ipv4_addrs() -> list[dict]:
    try:
        ip_binary = resolve_binary("ip")
        if not ip_binary:
            return []

        completed = subprocess.run(
            [ip_binary, "-o", "-4", "addr", "show", "scope", "global"],
            capture_output=True,
            text=True,
            timeout=3,
        )
        if completed.returncode != 0:
            return []

        rows = []
        for line in completed.stdout.splitlines():
            parts = line.split()
            if len(parts) < 4:
                continue
            iface = parts[1]
            cidr = parts[3]
            ip_only = cidr.split("/")[0]
            rows.append({
                "interface": iface,
                "ip": ip_only,
                "cidr": cidr,
            })

        return rows
    except Exception:
        return []


def _default_gateway() -> str:
    try:
        ip_binary = resolve_binary("ip")
        if not ip_binary:
            return "-"

        completed = subprocess.run(
            [ip_binary, "route", "show", "default"],
            capture_output=True,
            text=True,
            timeout=3,
        )
        if completed.returncode != 0:
            return "-"

        parts = completed.stdout.strip().split()
        if "via" in parts:
            via_index = parts.index("via")
            if via_index + 1 < len(parts):
                return parts[via_index + 1]
        return "-"
    except Exception:
        return "-"


class ProfileUpdateRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    full_name: str = Field(default="", max_length=120)
    job_title: str = Field(default="", max_length=120)
    phone: str = Field(default="", max_length=40)


class AppearanceUpdateRequest(BaseModel):
    ui_theme: str = Field(pattern="^(dark|light)$")
    ui_language: str = Field(pattern="^(tr|en)$")


class AISettingsUpdateRequest(BaseModel):
    model_name: str = Field(min_length=1, max_length=128)
    timeout_sec: int = Field(ge=10, le=3600)
    use_fake_response: bool = False
    ollama_url: str = Field(min_length=1, max_length=300)


class ScanSettingsUpdateRequest(BaseModel):
    nmap_timeout_sec: int = Field(ge=10, le=7200)
    masscan_timeout_sec: int = Field(ge=10, le=7200)
    netdiscover_timeout_sec: int = Field(ge=10, le=7200)


def _public_user(user: dict) -> dict:
    return {
        "id": user["id"],
        "username": user["username"],
        "full_name": user.get("full_name", ""),
        "job_title": user.get("job_title", ""),
        "phone": user.get("phone", ""),
        "ui_theme": user.get("ui_theme", "dark"),
        "ui_language": user.get("ui_language", "tr"),
        "is_admin": bool(user.get("is_admin")),
        "is_active": bool(user.get("is_active", True)),
        "must_change_password": bool(user.get("must_change_password")),
        "roles": list(user.get("roles") or []),
        "created_at": user.get("created_at"),
        "updated_at": user.get("updated_at"),
    }


@router.get("/settings/access")
def settings_access(current_user: dict = Depends(get_current_user)):
    tabs = ["appearance", "system"]
    if current_user.get("is_admin"):
        tabs = ["appearance", "system", "ai", "scan", "workflow", "tools"]

    return {
        "user": _public_user(current_user),
        "tabs": tabs,
        "valid_roles": sorted(VALID_ROLES),
    }


@router.patch("/auth/profile")
def update_my_profile(
    request: Request,
    payload: ProfileUpdateRequest,
    current_user: dict = Depends(require_roles(allow_must_change_password=False)),
):
    lang = request_lang(request)
    desired = payload.username.strip()
    if desired != current_user["username"]:
        existing = get_user_by_username(desired)
        if existing and int(existing["id"]) != int(current_user["id"]):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=t(lang, "auth.usernameExists", "Bu kullanıcı adı zaten var"))

    try:
        updated = update_user(
            user_id=int(current_user["id"]),
            username=desired,
            full_name=payload.full_name,
            job_title=payload.job_title,
            phone=payload.phone,
        )
    except ValueError as exc:
        if str(exc) == "USERNAME_ALREADY_EXISTS":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=t(lang, "auth.usernameExists", "Bu kullanıcı adı zaten var")) from exc
        raise

    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=t(lang, "user.notFound", "Kullanıcı bulunamadı"))

    return {"item": _public_user(updated)}


@router.patch("/settings/appearance")
def update_my_appearance(
    request: Request,
    payload: AppearanceUpdateRequest,
    current_user: dict = Depends(require_roles(allow_must_change_password=False)),
):
    lang = request_lang(request)

    updated = update_user(
        user_id=int(current_user["id"]),
        ui_theme=payload.ui_theme,
        ui_language=payload.ui_language,
    )

    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=t(lang, "user.notFound", "Kullanıcı bulunamadı"))

    return {"item": _public_user(updated)}


@router.get("/settings/config")
def settings_config(current_user: dict = Depends(require_roles(allow_must_change_password=False))):
    settings = get_app_settings()
    if current_user.get("is_admin"):
        return settings
    return {"ai": {}, "scan": {}}


@router.get("/settings/system-info")
def settings_system_info(current_user: dict = Depends(require_roles(allow_must_change_password=False))):
    del current_user

    disk_total, disk_used, disk_free = shutil.disk_usage("/")
    ram_total, ram_available = _read_linux_ram_bytes()
    cpu_name = platform.processor() or os.getenv("PROCESSOR_IDENTIFIER", "Unknown")

    return {
        "project": {
            "name": "Smart Security Validation Platform",
            "short_name": "SSVP",
            "version": PROJECT_VERSION,
            "vendor": PROJECT_VENDOR,
            "repository_root": str(Path.cwd()),
        },
        "system": {
            "hostname": socket.gethostname(),
            "os": f"{platform.system()} {platform.release()}",
            "os_detail": platform.platform(),
            "python_version": platform.python_version(),
            "cpu": {
                "name": cpu_name,
                "logical_cores": os.cpu_count(),
                "architecture": platform.machine(),
            },
            "memory": {
                "total_bytes": ram_total,
                "available_bytes": ram_available,
                "total_gib": _bytes_to_gib(ram_total) if ram_total else None,
                "available_gib": _bytes_to_gib(ram_available) if ram_available else None,
            },
            "storage": {
                "root_path": "/",
                "total_bytes": disk_total,
                "used_bytes": disk_used,
                "free_bytes": disk_free,
                "total_gib": _bytes_to_gib(disk_total),
                "used_gib": _bytes_to_gib(disk_used),
                "free_gib": _bytes_to_gib(disk_free),
            },
            "network": {
                "gateway": _default_gateway(),
                "interfaces": _parse_ipv4_addrs(),
            },
        },
    }


@router.patch("/settings/scan")
def settings_scan_update(
    request: Request,
    payload: ScanSettingsUpdateRequest,
    current_user: dict = Depends(require_roles(allow_must_change_password=False)),
):
    lang = request_lang(request)
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=t(lang, "settings.onlyAdminCanUpdate", "Sadece admin bu ayarı değiştirebilir"))

    settings = update_app_settings({"scan": payload.model_dump()})
    return {"scan": settings["scan"]}


@router.patch("/settings/ai")
def settings_ai_update(
    request: Request,
    payload: AISettingsUpdateRequest,
    current_user: dict = Depends(require_roles(allow_must_change_password=False)),
):
    lang = request_lang(request)
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=t(lang, "settings.onlyAdminCanUpdate", "Sadece admin bu ayarı değiştirebilir"))

    settings = update_app_settings({"ai": payload.model_dump()})
    return {"ai": settings["ai"]}


@router.get("/settings/ai-models")
def settings_ai_models(request: Request, current_user: dict = Depends(require_roles(allow_must_change_password=False))):
    lang = request_lang(request)
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=t(lang, "settings.onlyAdminCanViewModels", "Sadece admin bu listeyi görebilir"))

    settings = get_app_settings()
    ollama_url = settings.get("ai", {}).get("ollama_url") or DEFAULT_SETTINGS.get("ai", {}).get("ollama_url", "http://localhost:11434/api/chat")
    tags_url = ollama_url.replace("/api/chat", "/api/tags")

    try:
        response = requests.get(tags_url, timeout=15)
        response.raise_for_status()
        data = response.json()
        models = [item.get("name") for item in data.get("models", []) if item.get("name")]
    except Exception:
        models = []

    return {
        "active_model": settings.get("ai", {}).get("model_name"),
        "models": models,
    }


@router.get("/settings/workflow-steps")
def settings_workflow_steps(current_user: dict = Depends(require_roles(allow_must_change_password=False))):
    if not current_user.get("is_admin"):
        return {"items": []}
    return {"items": list_workflow_steps(active_only=False)}


@router.post("/settings/workflow-steps", status_code=201)
def settings_workflow_step_create(
    request: Request,
    payload: WorkflowStepCreateRequest,
    current_user: dict = Depends(require_roles(allow_must_change_password=False)),
):
    lang = request_lang(request)
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=t(lang, "settings.onlyAdminCanUpdate", "Sadece admin bu ayarı değiştirebilir"))
    created = create_workflow_step(payload.model_dump())
    return {"item": created}


@router.patch("/settings/workflow-steps/{step_id}")
def settings_workflow_step_update(
    request: Request,
    step_id: int,
    payload: WorkflowStepUpdateRequest,
    current_user: dict = Depends(require_roles(allow_must_change_password=False)),
):
    lang = request_lang(request)
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=t(lang, "settings.onlyAdminCanUpdate", "Sadece admin bu ayarı değiştirebilir"))
    item = update_workflow_step(step_id, payload.model_dump(exclude_unset=True))
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=t(lang, "scan.route.jobNotFound", "Job bulunamadı"))
    return {"item": item}


@router.get("/settings/tool-registry")
def settings_tool_registry(current_user: dict = Depends(require_roles(allow_must_change_password=False))):
    if not current_user.get("is_admin"):
        return {"items": []}
    return {"items": list_tools(active_only=False)}


@router.post("/settings/tool-registry", status_code=201)
def settings_tool_registry_create(
    request: Request,
    payload: ToolCreateRequest,
    current_user: dict = Depends(require_roles(allow_must_change_password=False)),
):
    lang = request_lang(request)
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=t(lang, "settings.onlyAdminCanUpdate", "Sadece admin bu ayarı değiştirebilir"))
    created = create_tool(payload.model_dump())
    return {"item": created}


@router.patch("/settings/tool-registry/{tool_id}")
def settings_tool_registry_update(
    request: Request,
    tool_id: int,
    payload: ToolUpdateRequest,
    current_user: dict = Depends(require_roles(allow_must_change_password=False)),
):
    lang = request_lang(request)
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=t(lang, "settings.onlyAdminCanUpdate", "Sadece admin bu ayarı değiştirebilir"))
    item = update_tool(tool_id, payload.model_dump(exclude_unset=True))
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=t(lang, "scan.route.jobNotFound", "Job bulunamadı"))
    return {"item": item}


@router.get("/settings/tool-registry/{tool_id}/parameters")
def settings_tool_registry_parameters(tool_id: int, current_user: dict = Depends(require_roles(allow_must_change_password=False))):
    if not current_user.get("is_admin"):
        return {"items": []}
    return {"items": list_tool_parameters(tool_id)}


@router.post("/settings/tool-registry/{tool_id}/parameters", status_code=201)
def settings_tool_registry_parameter_create(
    request: Request,
    tool_id: int,
    payload: ToolParameterCreateRequest,
    current_user: dict = Depends(require_roles(allow_must_change_password=False)),
):
    lang = request_lang(request)
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=t(lang, "settings.onlyAdminCanUpdate", "Sadece admin bu ayarı değiştirebilir"))
    item = create_tool_parameter(tool_id, payload.model_dump())
    return {"item": item}


@router.patch("/settings/tool-registry/parameters/{parameter_id}")
def settings_tool_registry_parameter_update(
    request: Request,
    parameter_id: int,
    payload: ToolParameterUpdateRequest,
    current_user: dict = Depends(require_roles(allow_must_change_password=False)),
):
    lang = request_lang(request)
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=t(lang, "settings.onlyAdminCanUpdate", "Sadece admin bu ayarı değiştirebilir"))
    item = update_tool_parameter(parameter_id, payload.model_dump(exclude_unset=True))
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=t(lang, "scan.route.jobNotFound", "Job bulunamadı"))
    return {"item": item}
