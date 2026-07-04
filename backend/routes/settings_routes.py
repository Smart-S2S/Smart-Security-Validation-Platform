import os
import platform
import ast
import json
import re
import shutil
import socket
import subprocess
from pathlib import Path

import requests
from pymysql.err import IntegrityError
from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi import File, Form, UploadFile

from backend.auth import get_current_user, require_roles
from backend.i18n import request_lang, t
from backend.models.orchestrator_models import (
    StepItemCreateRequest,
    StepItemParameterCreateRequest,
    StepItemScriptContentUpdateRequest,
    StepItemParameterUpdateRequest,
    StepItemUpdateRequest,
    StepCreateRequest,
    StepUpdateRequest,
)
from backend.services.orchestrator_store import (
    create_step_item,
    create_step_item_parameter,
    create_step,
    create_progress_category,
    delete_step_item,
    delete_step_item_parameter,
    delete_progress_category,
    delete_step,
    list_step_item_parameters,
    list_step_items,
    list_progress_categories,
    list_steps,
    replace_step_item_parameters,
    get_step_item_script_content,
    save_step_item_script_content,
    update_step_item,
    update_step_item_parameter,
    update_progress_category,
    update_step,
    upload_step_item_script,
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
VALID_WORKFLOW_KEYS = {"scan", "attack", "remediation"}
PARAM_SCHEMA_ASSIGN_PATTERN = re.compile(r"SSVP_PARAM_SCHEMA\s*=", flags=re.MULTILINE)
PARAM_GET_PATTERN = re.compile(
    r"(?:params|parameters)\s*\.\s*get\(\s*['\"]([a-zA-Z0-9_\-\.]+)['\"]\s*(?:,\s*([^\)]+))?\)",
    flags=re.IGNORECASE,
)


def _normalize_workflow_key_or_400(value: str, language: str) -> str:
    normalized = (value or "scan").strip().lower()
    if normalized in VALID_WORKFLOW_KEYS:
        return normalized

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=t(language, "settings.invalidWorkflow", "Gecersiz workflow secimi"),
    )


def _coerce_bool(value) -> bool:
    if isinstance(value, bool):
        return value
    token = str(value or "").strip().lower()
    return token in {"1", "true", "yes", "on"}


def _safe_literal(value, fallback=""):
    if value is None:
        return fallback
    if isinstance(value, (str, int, float, bool, dict, list)):
        return value
    try:
        return ast.literal_eval(value)
    except Exception:
        return fallback


def _normalize_schema_item(raw: dict, index: int) -> dict | None:
    if not isinstance(raw, dict):
        return None

    key = str(raw.get("key") or raw.get("param_key") or "").strip()
    if not key:
        return None

    label = str(raw.get("label") or key.replace("_", " ").title()).strip() or key
    param_type = str(raw.get("type") or raw.get("param_type") or "string").strip().lower() or "string"
    default_value = raw.get("default", raw.get("default_value", ""))
    description = str(raw.get("description") or "").strip()
    sort_order = raw.get("sort_order", index * 10)
    try:
        sort_order = int(sort_order)
    except Exception:
        sort_order = index * 10

    options = raw.get("options_json", raw.get("options", []))
    if isinstance(options, str):
        try:
            parsed_options = json.loads(options)
            options = parsed_options if isinstance(parsed_options, (list, dict)) else []
        except Exception:
            options = []
    elif not isinstance(options, (list, dict)):
        options = []

    required = _coerce_bool(raw.get("required", raw.get("is_required", False)))

    return {
        "key": key,
        "label": label,
        "type": param_type,
        "default": default_value,
        "required": required,
        "description": description,
        "options_json": options,
        "sort_order": sort_order,
    }


def _extract_metadata_schema(script_source: str) -> list[dict]:
    source = str(script_source or "")
    if not source.strip() or not PARAM_SCHEMA_ASSIGN_PATTERN.search(source):
        return []

    try:
        tree = ast.parse(source)
    except Exception:
        return []

    schema_raw = None
    for node in ast.walk(tree):
        target_names: list[str] = []
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    target_names.append(target.id)
            if "SSVP_PARAM_SCHEMA" not in target_names:
                continue
            schema_raw = _safe_literal(node.value, None)
            break

        if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            if node.target.id != "SSVP_PARAM_SCHEMA":
                continue
            schema_raw = _safe_literal(node.value, None)
            break

    if schema_raw is None:
        return []

    if isinstance(schema_raw, dict):
        if isinstance(schema_raw.get("parameters"), list):
            schema_raw = schema_raw.get("parameters")
        else:
            return []

    if not isinstance(schema_raw, list):
        return []

    normalized: list[dict] = []
    for idx, item in enumerate(schema_raw):
        candidate = _normalize_schema_item(item, idx)
        if candidate:
            normalized.append(candidate)

    normalized.sort(key=lambda row: int(row.get("sort_order") or 100))
    return normalized


def _infer_schema_from_source(script_source: str) -> list[dict]:
    source = str(script_source or "")
    if not source.strip():
        return []

    discovered: list[dict] = []
    by_key: dict[str, dict] = {}
    for line in source.splitlines():
        match = PARAM_GET_PATTERN.search(line)
        if not match:
            continue

        key = str(match.group(1) or "").strip()
        if not key:
            continue

        default_expr = str(match.group(2) or "").strip()
        default_value = _safe_literal(default_expr, "") if default_expr else ""
        candidate = {
            "key": key,
            "label": key.replace("_", " ").title(),
            "type": "boolean" if isinstance(default_value, bool) else "number" if isinstance(default_value, (int, float)) else "string",
            "default": default_value,
            "required": False,
            "description": "",
            "options_json": [],
            "sort_order": len(discovered) * 10,
        }
        existing = by_key.get(key)
        if not existing:
            discovered.append(candidate)
            by_key[key] = candidate
            continue

        if existing.get("default") in ("", None) and candidate.get("default") not in ("", None):
            existing["default"] = candidate.get("default")
            existing["type"] = candidate.get("type")

    return discovered


def _detect_script_parameter_schema(script_source: str) -> dict:
    metadata_schema = _extract_metadata_schema(script_source)
    if metadata_schema:
        return {"source": "metadata", "items": metadata_schema}

    inferred = _infer_schema_from_source(script_source)
    if inferred:
        return {"source": "inference", "items": inferred}

    return {"source": "none", "items": []}
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


class DetectedStepItemParametersSaveRequest(BaseModel):
    items: list[dict] = Field(default_factory=list)


class ProgressCategoryCreateRequest(BaseModel):
    category_key: str = Field(min_length=2, max_length=120)
    display_name: str = Field(min_length=2, max_length=160)
    workflow_key: str = Field(default="scan", min_length=2, max_length=32)
    description: str = Field(default="", max_length=2000)
    is_active: bool = True


class ProgressCategoryUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=2, max_length=160)
    workflow_key: str | None = Field(default=None, min_length=2, max_length=32)
    description: str | None = Field(default=None, max_length=2000)
    is_active: bool | None = None


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
        tabs = ["appearance", "system", "ai", "scan", "tools", "progress-categories"]

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


@router.get("/settings/progress-categories")
def settings_progress_categories(current_user: dict = Depends(require_roles(allow_must_change_password=False))):
    if not current_user.get("is_admin"):
        return {"items": []}
    return {"items": list_progress_categories(active_only=False)}


@router.post("/settings/progress-categories", status_code=201)
def settings_progress_categories_create(
    request: Request,
    payload: ProgressCategoryCreateRequest,
    current_user: dict = Depends(require_roles(allow_must_change_password=False)),
):
    lang = request_lang(request)
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=t(lang, "settings.onlyAdminCanUpdate", "Sadece admin bu ayarı değiştirebilir"))

    data = payload.model_dump()
    data["workflow_key"] = _normalize_workflow_key_or_400(data.get("workflow_key") or "scan", lang)
    try:
        item = create_progress_category(data)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=t(lang, "settings.categoryAlreadyExists", "Kategori anahtari zaten kullaniliyor"),
        ) from exc
    return {"item": item}


@router.patch("/settings/progress-categories/{category_id}")
def settings_progress_categories_update(
    request: Request,
    category_id: int,
    payload: ProgressCategoryUpdateRequest,
    current_user: dict = Depends(require_roles(allow_must_change_password=False)),
):
    lang = request_lang(request)
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=t(lang, "settings.onlyAdminCanUpdate", "Sadece admin bu ayarı değiştirebilir"))

    data = payload.model_dump(exclude_unset=True)
    if "workflow_key" in data and data["workflow_key"] is not None:
        data["workflow_key"] = _normalize_workflow_key_or_400(data.get("workflow_key") or "scan", lang)
    item = update_progress_category(category_id, data)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=t(lang, "scan.route.jobNotFound", "Job bulunamadı"))
    return {"item": item}


@router.delete("/settings/progress-categories/{category_id}")
def settings_progress_categories_delete(
    request: Request,
    category_id: int,
    current_user: dict = Depends(require_roles(allow_must_change_password=False)),
):
    lang = request_lang(request)
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=t(lang, "settings.onlyAdminCanUpdate", "Sadece admin bu ayarı değiştirebilir"))
    try:
        deleted = delete_progress_category(category_id)
    except ValueError as exc:
        if str(exc) == "CATEGORY_IN_USE":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=t(lang, "settings.categoryInUse", "Bu kategori bir tool tarafinda kullanildigi icin silinemez"),
            ) from exc
        raise
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=t(lang, "scan.route.jobNotFound", "Job bulunamadı"))
    return {"ok": True}


@router.get("/settings/steps")
def settings_steps(
    current_user: dict = Depends(require_roles(allow_must_change_password=False)),
    workflow_key: str | None = None,
    category_key: str | None = None,
):
    if not current_user.get("is_admin"):
        return {"items": []}
    return {
        "items": list_steps(
            active_only=False,
            workflow_key=workflow_key,
            category_key=category_key,
        )
    }


@router.post("/settings/steps", status_code=201)
def settings_steps_create(
    request: Request,
    payload: StepCreateRequest,
    current_user: dict = Depends(require_roles(allow_must_change_password=False)),
):
    lang = request_lang(request)
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=t(lang, "settings.onlyAdminCanUpdate", "Sadece admin bu ayarı değiştirebilir"))

    data = payload.model_dump()
    data["workflow_key"] = _normalize_workflow_key_or_400(data.get("workflow_key") or "scan", lang)
    try:
        item = create_step(data)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=t(lang, "settings.toolNameConflict", "Ayni action key ile baska tool var. Lutfen farkli isim kullanin"),
        ) from exc
    return {"item": item}


@router.patch("/settings/steps/{step_id}")
def settings_steps_update(
    request: Request,
    step_id: int,
    payload: StepUpdateRequest,
    current_user: dict = Depends(require_roles(allow_must_change_password=False)),
):
    lang = request_lang(request)
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=t(lang, "settings.onlyAdminCanUpdate", "Sadece admin bu ayarı değiştirebilir"))

    item = update_step(step_id, payload.model_dump(exclude_unset=True))
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=t(lang, "scan.route.jobNotFound", "Job bulunamadı"))
    return {"item": item}


@router.delete("/settings/steps/{step_id}")
def settings_steps_delete(
    request: Request,
    step_id: int,
    current_user: dict = Depends(require_roles(allow_must_change_password=False)),
):
    lang = request_lang(request)
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=t(lang, "settings.onlyAdminCanUpdate", "Sadece admin bu ayarı değiştirebilir"))

    try:
        deleted = delete_step(step_id)
    except ValueError as exc:
        if str(exc) == "STEP_IN_USE":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=t(lang, "settings.categoryInUse", "Bu kategori bir tool tarafinda kullanildigi icin silinemez"),
            ) from exc
        raise

    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=t(lang, "scan.route.jobNotFound", "Job bulunamadı"))
    return {"ok": True}


@router.get("/settings/steps/{step_id}/items")
def settings_step_items(
    step_id: int,
    current_user: dict = Depends(require_roles(allow_must_change_password=False)),
):
    if not current_user.get("is_admin"):
        return {"items": []}
    return {"items": list_step_items(step_id, active_only=False)}


@router.post("/settings/steps/{step_id}/items", status_code=201)
def settings_step_items_create(
    request: Request,
    step_id: int,
    payload: StepItemCreateRequest,
    current_user: dict = Depends(require_roles(allow_must_change_password=False)),
):
    lang = request_lang(request)
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=t(lang, "settings.onlyAdminCanUpdate", "Sadece admin bu ayarı değiştirebilir"))

    data = payload.model_dump()
    try:
        item = create_step_item(step_id, data)
    except ValueError as exc:
        if str(exc) == "STEP_NOT_FOUND":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=t(lang, "scan.route.jobNotFound", "Job bulunamadı")) from exc
        raise
    except IntegrityError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=t(lang, "settings.toolNameConflict", "Ayni action key ile baska tool var. Lutfen farkli isim kullanin")) from exc
    return {"item": item}


@router.patch("/settings/steps/items/{item_id}")
def settings_step_items_update(
    request: Request,
    item_id: int,
    payload: StepItemUpdateRequest,
    current_user: dict = Depends(require_roles(allow_must_change_password=False)),
):
    lang = request_lang(request)
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=t(lang, "settings.onlyAdminCanUpdate", "Sadece admin bu ayarı değiştirebilir"))

    try:
        item = update_step_item(item_id, payload.model_dump(exclude_unset=True))
    except IntegrityError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=t(lang, "settings.toolNameConflict", "Ayni action key ile baska tool var. Lutfen farkli isim kullanin")) from exc

    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=t(lang, "scan.route.jobNotFound", "Job bulunamadı"))
    return {"item": item}


@router.delete("/settings/steps/items/{item_id}")
def settings_step_items_delete(
    request: Request,
    item_id: int,
    current_user: dict = Depends(require_roles(allow_must_change_password=False)),
):
    lang = request_lang(request)
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=t(lang, "settings.onlyAdminCanUpdate", "Sadece admin bu ayarı değiştirebilir"))

    deleted = delete_step_item(item_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=t(lang, "scan.route.jobNotFound", "Job bulunamadı"))
    return {"ok": True}


@router.post("/settings/steps/items/{item_id}/script-upload")
async def settings_step_items_upload_script(
    request: Request,
    item_id: int,
    file: UploadFile = File(...),
    script_name: str = Form(default=""),
    current_user: dict = Depends(require_roles(allow_must_change_password=False)),
):
    del script_name
    lang = request_lang(request)
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=t(lang, "settings.onlyAdminCanUpdate", "Sadece admin bu ayarı değiştirebilir"))

    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=t(lang, "settings.emptyScriptFile", "Script dosyasi bos olamaz"))

    try:
        item = upload_step_item_script(item_id, filename=file.filename or "script.py", content=content)
    except ValueError as exc:
        if str(exc) == "STEP_ITEM_NOT_FOUND":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=t(lang, "scan.route.jobNotFound", "Job bulunamadı")) from exc
        if str(exc) == "ITEM_NOT_SCRIPT":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=t(lang, "settings.invalidScriptType", "Secili kayit script tipi degil")) from exc
        raise

    return {"item": item}


@router.get("/settings/steps/items/{item_id}/script-content")
def settings_step_item_script_content(
    request: Request,
    item_id: int,
    current_user: dict = Depends(require_roles(allow_must_change_password=False)),
):
    lang = request_lang(request)
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=t(lang, "settings.onlyAdminCanUpdate", "Sadece admin bu ayarı değiştirebilir"))

    try:
        return get_step_item_script_content(item_id)
    except ValueError as exc:
        if str(exc) == "STEP_ITEM_NOT_FOUND":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=t(lang, "scan.route.jobNotFound", "Job bulunamadı")) from exc
        if str(exc) == "ITEM_NOT_SCRIPT":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=t(lang, "settings.invalidScriptType", "Secili kayit script tipi degil")) from exc
        raise


@router.patch("/settings/steps/items/{item_id}/script-content")
def settings_step_item_script_content_update(
    request: Request,
    item_id: int,
    payload: StepItemScriptContentUpdateRequest,
    current_user: dict = Depends(require_roles(allow_must_change_password=False)),
):
    lang = request_lang(request)
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=t(lang, "settings.onlyAdminCanUpdate", "Sadece admin bu ayarı değiştirebilir"))

    try:
        return save_step_item_script_content(item_id, payload.script_source)
    except ValueError as exc:
        if str(exc) == "STEP_ITEM_NOT_FOUND":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=t(lang, "scan.route.jobNotFound", "Job bulunamadı")) from exc
        if str(exc) == "ITEM_NOT_SCRIPT":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=t(lang, "settings.invalidScriptType", "Secili kayit script tipi degil")) from exc
        raise


@router.post("/settings/steps/items/{item_id}/parameters/detect")
def settings_step_item_parameters_detect(
    request: Request,
    item_id: int,
    current_user: dict = Depends(require_roles(allow_must_change_password=False)),
):
    lang = request_lang(request)
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=t(lang, "settings.onlyAdminCanUpdate", "Sadece admin bu ayarı değiştirebilir"))

    try:
        content_payload = get_step_item_script_content(item_id)
    except ValueError as exc:
        if str(exc) == "STEP_ITEM_NOT_FOUND":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=t(lang, "scan.route.jobNotFound", "Job bulunamadı")) from exc
        if str(exc) == "ITEM_NOT_SCRIPT":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=t(lang, "settings.invalidScriptType", "Secili kayit script tipi degil")) from exc
        raise

    script_source = str(content_payload.get("content") or "")
    detected = _detect_script_parameter_schema(script_source)
    return {
        "source": detected.get("source") or "none",
        "items": detected.get("items") or [],
    }


@router.post("/settings/steps/items/{item_id}/parameters/save-detected")
def settings_step_item_parameters_save_detected(
    request: Request,
    item_id: int,
    payload: DetectedStepItemParametersSaveRequest,
    current_user: dict = Depends(require_roles(allow_must_change_password=False)),
):
    lang = request_lang(request)
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=t(lang, "settings.onlyAdminCanUpdate", "Sadece admin bu ayarı değiştirebilir"))

    normalized_items: list[dict] = []
    for idx, raw in enumerate(payload.items):
        candidate = _normalize_schema_item(raw, idx)
        if candidate:
            normalized_items.append(candidate)

    try:
        rows = replace_step_item_parameters(item_id, normalized_items)
    except ValueError as exc:
        if str(exc) == "STEP_ITEM_NOT_FOUND":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=t(lang, "scan.route.jobNotFound", "Job bulunamadı")) from exc
        raise

    return {"items": rows}


@router.get("/settings/steps/items/{item_id}/parameters")
def settings_step_item_parameters(
    item_id: int,
    current_user: dict = Depends(require_roles(allow_must_change_password=False)),
):
    if not current_user.get("is_admin"):
        return {"items": []}
    return {"items": list_step_item_parameters(item_id)}


@router.post("/settings/steps/items/{item_id}/parameters", status_code=201)
def settings_step_item_parameters_create(
    request: Request,
    item_id: int,
    payload: StepItemParameterCreateRequest,
    current_user: dict = Depends(require_roles(allow_must_change_password=False)),
):
    lang = request_lang(request)
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=t(lang, "settings.onlyAdminCanUpdate", "Sadece admin bu ayarı değiştirebilir"))

    try:
        item = create_step_item_parameter(item_id, payload.model_dump())
    except ValueError as exc:
        if str(exc) == "STEP_ITEM_NOT_FOUND":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=t(lang, "scan.route.jobNotFound", "Job bulunamadı")) from exc
        if str(exc) == "ITEM_NOT_TASK":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=t(lang, "settings.invalidTaskType", "Parametre sadece gorev tipinde tanimlanabilir")) from exc
        raise
    except IntegrityError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=t(lang, "settings.toolNameConflict", "Ayni action key ile baska tool var. Lutfen farkli isim kullanin")) from exc
    return {"item": item}


@router.patch("/settings/steps/parameters/{param_id}")
def settings_step_item_parameters_update(
    request: Request,
    param_id: int,
    payload: StepItemParameterUpdateRequest,
    current_user: dict = Depends(require_roles(allow_must_change_password=False)),
):
    lang = request_lang(request)
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=t(lang, "settings.onlyAdminCanUpdate", "Sadece admin bu ayarı değiştirebilir"))

    item = update_step_item_parameter(param_id, payload.model_dump(exclude_unset=True))
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=t(lang, "scan.route.jobNotFound", "Job bulunamadı"))
    return {"item": item}


@router.delete("/settings/steps/parameters/{param_id}")
def settings_step_item_parameters_delete(
    request: Request,
    param_id: int,
    current_user: dict = Depends(require_roles(allow_must_change_password=False)),
):
    lang = request_lang(request)
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=t(lang, "settings.onlyAdminCanUpdate", "Sadece admin bu ayarı değiştirebilir"))

    deleted = delete_step_item_parameter(param_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=t(lang, "scan.route.jobNotFound", "Job bulunamadı"))
    return {"ok": True}
