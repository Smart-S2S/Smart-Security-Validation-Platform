from __future__ import annotations

import re
from dataclasses import dataclass

from backend.services.orchestrator_store import (
    create_progress_category,
    create_step,
    create_step_item,
    create_step_item_parameter,
    list_progress_categories,
    list_step_item_parameters,
    list_step_items,
    list_steps,
    save_step_item_script_content,
    update_progress_category,
    update_step,
    update_step_item,
    update_step_item_parameter,
)


def slugify(value: str, fallback: str = "item") -> str:
    token = re.sub(r"[^a-z0-9_]+", "_", (value or "").strip().lower()).strip("_")
    return token or fallback


def build_compound_step_key(workflow_key: str, category_key: str, step_key: str) -> str:
    return slugify(f"{workflow_key}_{category_key}_{step_key}", "step")


@dataclass
class SeedCounters:
    created_categories: int = 0
    updated_categories: int = 0
    created_steps: int = 0
    updated_steps: int = 0
    created_items: int = 0
    updated_items: int = 0
    created_params: int = 0
    updated_params: int = 0
    updated_scripts: int = 0


def upsert_category(counters: SeedCounters, category: dict) -> dict:
    existing = {
        row["category_key"]: row
        for row in list_progress_categories(active_only=False)
    }
    key = slugify(category["category_key"], "general")
    payload = {
        "category_key": key,
        "display_name": category["display_name"],
        "workflow_key": category["workflow_key"],
        "description": category.get("description", ""),
        "is_active": True,
    }

    if key in existing:
        row = update_progress_category(existing[key]["id"], payload)
        counters.updated_categories += 1
        return row

    row = create_progress_category(payload)
    counters.created_categories += 1
    return row


def upsert_step(counters: SeedCounters, category_key: str, step: dict) -> dict:
    all_steps = list_steps(active_only=False, workflow_key=step["workflow_key"], category_key=category_key)
    compound_key = build_compound_step_key(step["workflow_key"], category_key, step["step_key"])
    current = next((row for row in all_steps if row["step_key"] == compound_key), None)

    if current:
        updated = update_step(
            int(current["id"]),
            {
                "display_name": step["display_name"],
                "description": step.get("description", ""),
                "is_active": True,
            },
        )
        counters.updated_steps += 1
        return updated

    created = create_step(
        {
            "step_key": step["step_key"],
            "display_name": step["display_name"],
            "workflow_key": step["workflow_key"],
            "category_key": category_key,
            "description": step.get("description", ""),
            "is_active": True,
        }
    )
    counters.created_steps += 1
    return created


def upsert_item(counters: SeedCounters, step_id: int, item: dict) -> dict:
    rows = list_step_items(step_id, active_only=False)
    key = slugify(item["item_key"], "item")
    current = next((row for row in rows if slugify(row.get("item_key", ""), "item") == key), None)

    payload = {
        "item_type": item["item_type"],
        "item_key": key,
        "display_name": item["display_name"],
        "description": item.get("description", ""),
        "is_active": True,
    }

    if current:
        updated = update_step_item(int(current["id"]), payload)
        counters.updated_items += 1
        return updated

    created = create_step_item(step_id, payload)
    counters.created_items += 1
    return created


def upsert_item_param(counters: SeedCounters, item_id: int, param: dict) -> dict:
    rows = list_step_item_parameters(item_id)
    key = slugify(param["param_key"], "param")
    current = next((row for row in rows if slugify(row.get("param_key", ""), "param") == key), None)

    payload = {
        "param_key": key,
        "label": param["label"],
        "param_type": param.get("param_type", "string"),
        "default_value": str(param.get("default_value", "")),
        "is_required": bool(param.get("is_required", False)),
        "sort_order": int(param.get("sort_order", 100)),
    }

    if current:
        updated = update_step_item_parameter(
            int(current["id"]),
            {
                "label": payload["label"],
                "param_type": payload["param_type"],
                "default_value": payload["default_value"],
                "is_required": payload["is_required"],
                "sort_order": payload["sort_order"],
            },
        )
        counters.updated_params += 1
        return updated

    created = create_step_item_parameter(item_id, payload)
    counters.created_params += 1
    return created


SEED_DATA = [
    {
        "category_key": "network",
        "display_name": "Network",
        "workflow_key": "scan",
        "description": "Scan ve kesif adimlari",
        "steps": [
            {
                "step_key": "demo_scan_validation",
                "display_name": "Demo Scan Validation",
                "workflow_key": "scan",
                "description": "Demo AI intent ciktilarini karsilayan scan dogrulama adimi.",
                "items": [
                    {
                        "item_type": "script",
                        "item_key": "service_detection",
                        "display_name": "Service Detection",
                        "description": "Servis ve versiyon bazli dogrulama scripti.",
                        "parameters": [
                            {"param_key": "target_host", "label": "Target Host", "param_type": "string", "default_value": "", "is_required": True, "sort_order": 10},
                            {"param_key": "scan_ports", "label": "Scan Ports", "param_type": "list", "default_value": "[\"22\",\"80\",\"443\"]", "is_required": True, "sort_order": 20},
                            {"param_key": "service_version", "label": "Service Version Probe", "param_type": "bool", "default_value": "true", "is_required": False, "sort_order": 30},
                            {"param_key": "timeout_sec", "label": "Timeout Sec", "param_type": "number", "default_value": "120", "is_required": False, "sort_order": 40},
                        ],
                        "script_source": """
# SSVP_SCRIPT_TEMPLATE_V1
import json
import os
import time


def _load():
    try:
        return json.loads(os.getenv(\"SSVP_INPUT_JSON\", \"{}\"))
    except Exception:
        return {}


def _log(msg):
    print(f\"[SCAN] {msg}\", flush=True)


def main():
    payload = _load()
    target = payload.get(\"target\", \"\")
    params = payload.get(\"parameters\", {})
    ports = params.get(\"scan_ports\", [\"22\", \"80\", \"443\"])

    _log(f\"target resolved: {target}\")
    _log(f\"ports queued: {ports}\")
    time.sleep(0.1)
    _log(\"service handshake checks running\")
    time.sleep(0.1)

    result = {
        \"ok\": True,
        \"action\": \"service_detection\",
        \"target\": target,
        \"service_count\": len(ports),
        \"ports\": ports,
        \"hints\": [\"version mismatch check\", \"weak cipher review\"],
    }
    print(\"SSVP_RESULT_JSON:\" + json.dumps(result, ensure_ascii=False), flush=True)


if __name__ == \"__main__\":
    main()
""",
                    },
                    {
                        "item_type": "script",
                        "item_key": "port_discovery_fast",
                        "display_name": "Port Discovery Fast",
                        "description": "Hizli port dogrulama scripti.",
                        "parameters": [
                            {"param_key": "target_range", "label": "Target Range", "param_type": "string", "default_value": "172.31.0.0/16", "is_required": True, "sort_order": 10},
                            {"param_key": "scan_ports", "label": "Scan Ports", "param_type": "list", "default_value": "[\"all\"]", "is_required": True, "sort_order": 20},
                            {"param_key": "rate_profile", "label": "Rate Profile", "param_type": "string", "default_value": "rate-1000", "is_required": False, "sort_order": 30},
                        ],
                        "script_source": """
# SSVP_SCRIPT_TEMPLATE_V1
import json
import os
import time


def _load():
    try:
        return json.loads(os.getenv(\"SSVP_INPUT_JSON\", \"{}\"))
    except Exception:
        return {}


def _log(msg):
    print(f\"[FAST_PORT] {msg}\", flush=True)


def main():
    payload = _load()
    target = payload.get(\"target\", \"\")
    params = payload.get(\"parameters\", {})
    ports = params.get(\"scan_ports\", [\"all\"])

    _log(f\"target range: {target}\")
    _log(f\"port profile: {ports}\")
    _log(\"fast probe wave #1\")
    time.sleep(0.1)
    _log(\"fast probe wave #2\")
    time.sleep(0.1)

    open_ports = [\"22\", \"80\", \"443\", \"3306\"]
    result = {
        \"ok\": True,
        \"action\": \"port_discovery_fast\",
        \"target\": target,
        \"open_ports\": open_ports,
        \"requested_ports\": ports,
    }
    print(\"SSVP_RESULT_JSON:\" + json.dumps(result, ensure_ascii=False), flush=True)


if __name__ == \"__main__\":
    main()
""",
                    },
                    {
                        "item_type": "script",
                        "item_key": "local_network_discovery",
                        "display_name": "Local Network Discovery",
                        "description": "Yerel ag host kesfi scripti.",
                        "parameters": [
                            {"param_key": "target_range", "label": "Target Range", "param_type": "string", "default_value": "172.31.0.0/16", "is_required": True, "sort_order": 10},
                            {"param_key": "discovery_mode", "label": "Discovery Mode", "param_type": "string", "default_value": "icmp,tcp", "is_required": False, "sort_order": 20},
                        ],
                        "script_source": """
# SSVP_SCRIPT_TEMPLATE_V1
import json
import os


def _load():
    try:
        return json.loads(os.getenv(\"SSVP_INPUT_JSON\", \"{}\"))
    except Exception:
        return {}


def _log(msg):
    print(f\"[DISCOVERY] {msg}\", flush=True)


def main():
    payload = _load()
    target = payload.get(\"target\", \"\")
    params = payload.get(\"parameters\", {})

    _log(f\"network discovery started for {target}\")
    _log(f\"mode: {params.get('discovery_mode', 'icmp,tcp')}\")

    result = {
        \"ok\": True,
        \"action\": \"local_network_discovery\",
        \"target\": target,
        \"hosts_found\": [\"172.31.7.145\", \"172.31.7.150\"],
    }
    print(\"SSVP_RESULT_JSON:\" + json.dumps(result, ensure_ascii=False), flush=True)


if __name__ == \"__main__\":
    main()
""",
                    },
                    {
                        "item_type": "task",
                        "item_key": "collect_service_baseline",
                        "display_name": "Collect Service Baseline",
                        "description": "Script oncesi baseline gorevi.",
                        "parameters": [
                            {"param_key": "baseline_profile", "label": "Baseline Profile", "param_type": "string", "default_value": "default", "is_required": True, "sort_order": 10},
                            {"param_key": "include_tls", "label": "Include TLS", "param_type": "bool", "default_value": "true", "is_required": False, "sort_order": 20},
                        ],
                    },
                ],
            }
        ],
    },
    {
        "category_key": "web_applications",
        "display_name": "Web Uygulamalari",
        "workflow_key": "attack",
        "description": "Yetkili aktif dogrulama adimlari",
        "steps": [
            {
                "step_key": "demo_attack_validation",
                "display_name": "Demo Attack Validation",
                "workflow_key": "attack",
                "description": "Atak asamasinda guvenli dogrulama scriptleri.",
                "items": [
                    {
                        "item_type": "script",
                        "item_key": "credential_policy_probe",
                        "display_name": "Credential Policy Probe",
                        "description": "Login policy kontrolleri.",
                        "parameters": [
                            {"param_key": "login_endpoint", "label": "Login Endpoint", "param_type": "string", "default_value": "https://target/login", "is_required": True, "sort_order": 10},
                            {"param_key": "max_attempt", "label": "Max Attempt", "param_type": "number", "default_value": "5", "is_required": False, "sort_order": 20},
                        ],
                        "script_source": """
# SSVP_SCRIPT_TEMPLATE_V1
import json
import os


def _load():
    try:
        return json.loads(os.getenv(\"SSVP_INPUT_JSON\", \"{}\"))
    except Exception:
        return {}


def _log(msg):
    print(f\"[ATTACK_VALIDATION] {msg}\", flush=True)


def main():
    payload = _load()
    target = payload.get(\"target\", \"\")
    params = payload.get(\"parameters\", {})
    _log(f\"policy probe target: {target}\")
    _log(f\"endpoint: {params.get('login_endpoint', '')}\")
    result = {
        \"ok\": True,
        \"action\": \"credential_policy_probe\",
        \"target\": target,
        \"lockout_detected\": True,
    }
    print(\"SSVP_RESULT_JSON:\" + json.dumps(result, ensure_ascii=False), flush=True)


if __name__ == \"__main__\":
    main()
""",
                    },
                    {
                        "item_type": "task",
                        "item_key": "manual_attack_review",
                        "display_name": "Manual Attack Review",
                        "description": "Manuel inceleme gorevi.",
                        "parameters": [
                            {"param_key": "review_scope", "label": "Review Scope", "param_type": "string", "default_value": "auth-flow", "is_required": True, "sort_order": 10},
                        ],
                    },
                ],
            }
        ],
    },
    {
        "category_key": "remediation",
        "display_name": "Duzenleme",
        "workflow_key": "remediation",
        "description": "Duzeltme ve retest adimlari",
        "steps": [
            {
                "step_key": "demo_remediation_validation",
                "display_name": "Demo Remediation Validation",
                "workflow_key": "remediation",
                "description": "Duzeltme sonrasi dogrulama scriptleri.",
                "items": [
                    {
                        "item_type": "script",
                        "item_key": "baseline_hardening_retest",
                        "display_name": "Baseline Hardening Retest",
                        "description": "Hardening retest scripti.",
                        "parameters": [
                            {"param_key": "host", "label": "Host", "param_type": "string", "default_value": "", "is_required": True, "sort_order": 10},
                            {"param_key": "policy_profile", "label": "Policy Profile", "param_type": "string", "default_value": "baseline", "is_required": False, "sort_order": 20},
                        ],
                        "script_source": """
# SSVP_SCRIPT_TEMPLATE_V1
import json
import os


def _load():
    try:
        return json.loads(os.getenv(\"SSVP_INPUT_JSON\", \"{}\"))
    except Exception:
        return {}


def _log(msg):
    print(f\"[RETEST] {msg}\", flush=True)


def main():
    payload = _load()
    target = payload.get(\"target\", \"\")
    params = payload.get(\"parameters\", {})
    _log(f\"retest target: {target}\")
    _log(f\"profile: {params.get('policy_profile', 'baseline')}\")
    result = {
        \"ok\": True,
        \"action\": \"baseline_hardening_retest\",
        \"target\": target,
        \"compliance\": 0.92,
    }
    print(\"SSVP_RESULT_JSON:\" + json.dumps(result, ensure_ascii=False), flush=True)


if __name__ == \"__main__\":
    main()
""",
                    },
                    {
                        "item_type": "script",
                        "item_key": "config_drift_verify",
                        "display_name": "Config Drift Verify",
                        "description": "Config drift dogrulama scripti.",
                        "parameters": [
                            {"param_key": "source_tag", "label": "Source Tag", "param_type": "string", "default_value": "before_fix", "is_required": True, "sort_order": 10},
                            {"param_key": "target_tag", "label": "Target Tag", "param_type": "string", "default_value": "after_fix", "is_required": True, "sort_order": 20},
                        ],
                        "script_source": """
# SSVP_SCRIPT_TEMPLATE_V1
import json
import os


def _load():
    try:
        return json.loads(os.getenv(\"SSVP_INPUT_JSON\", \"{}\"))
    except Exception:
        return {}


def _log(msg):
    print(f\"[DRIFT] {msg}\", flush=True)


def main():
    payload = _load()
    target = payload.get(\"target\", \"\")
    params = payload.get(\"parameters\", {})
    _log(f\"compare {params.get('source_tag')} -> {params.get('target_tag')}\")
    result = {
        \"ok\": True,
        \"action\": \"config_drift_verify\",
        \"target\": target,
        \"drift_count\": 2,
        \"critical\": 0,
    }
    print(\"SSVP_RESULT_JSON:\" + json.dumps(result, ensure_ascii=False), flush=True)


if __name__ == \"__main__\":
    main()
""",
                    },
                    {
                        "item_type": "task",
                        "item_key": "collect_fix_evidence",
                        "display_name": "Collect Fix Evidence",
                        "description": "Duzeltme kaniti toplama gorevi.",
                        "parameters": [
                            {"param_key": "evidence_path", "label": "Evidence Path", "param_type": "string", "default_value": "/var/log/ssvp", "is_required": True, "sort_order": 10},
                        ],
                    },
                ],
            }
        ],
    },
]


def run_seed() -> SeedCounters:
    counters = SeedCounters()

    for category in SEED_DATA:
        category_row = upsert_category(counters, category)
        category_key = category_row["category_key"]

        for step in category.get("steps", []):
            step_row = upsert_step(counters, category_key, step)

            for item in step.get("items", []):
                item_row = upsert_item(counters, int(step_row["id"]), item)

                for param in item.get("parameters", []):
                    upsert_item_param(counters, int(item_row["id"]), param)

                if item.get("item_type") == "script" and item.get("script_source"):
                    save_step_item_script_content(int(item_row["id"]), item["script_source"])
                    counters.updated_scripts += 1

    return counters


if __name__ == "__main__":
    stats = run_seed()
    print("Demo workflow content seed tamamlandi")
    print(
        "Created => categories:{0} steps:{1} items:{2} params:{3}".format(
            stats.created_categories,
            stats.created_steps,
            stats.created_items,
            stats.created_params,
        )
    )
    print(
        "Updated => categories:{0} steps:{1} items:{2} params:{3} scripts:{4}".format(
            stats.updated_categories,
            stats.updated_steps,
            stats.updated_items,
            stats.updated_params,
            stats.updated_scripts,
        )
    )
