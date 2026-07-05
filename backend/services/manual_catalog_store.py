"""Rebuild the manual 3-way (3YM) progression catalog from the tool specs.

The manual flow (progress_categories → steps → step_items → step_item_parameters)
is INDEPENDENT of the AI Orchestrator's ai_operations tables, but shares the same
tool specs (``pentest_tool_specs``) so its scripts and parameters look and behave
just like the AI side's — only here the operator drives selection, with no AI.

Design points from the requirement:
- A clean rebuild: the four manual tables are truncated (keys restart from 1) and
  the on-disk step scripts are cleared before reseeding.
- Tools are placed into meaningful categories/steps per direction, and the SAME
  tool may appear in several steps (step_items is unique per (step, item_key), so
  the same item_key is allowed under different steps). The operator tunes the
  behaviour per step via parameters (e.g. nmap host-discovery vs full scan).
- Never touches ai_operations / ai_operation_params (that is the YZO side).
"""

from __future__ import annotations

import shutil
from pathlib import Path

from backend.services.mysql_db import mysql_conn
from backend.services.orchestrator_store import (
    create_progress_category,
    create_step,
    create_step_item,
    init_orchestrator_store,
    replace_step_item_parameters,
    save_step_item_script_content,
)
from backend.services.pentest_tool_specs import iter_operations


_SCRIPT_DIR = Path(__file__).resolve().parents[2] / "data" / "step_item_scripts"


# ---------------------------------------------------------------------------
# Manual catalog map: direction -> categories -> steps -> tool operation_keys.
# operation_key values reference pentest_tool_specs tools. A tool listed under
# multiple steps is intentional ("bir tool farklı adımlarda kullanılabilir").
# ---------------------------------------------------------------------------
MANUAL_CATALOG = [
    # ===================== SCAN =====================
    {
        "workflow_key": "scan",
        "category_key": "network_discovery",
        "category_name": "Ağ Keşfi",
        "steps": [
            {"step_key": "host_discovery", "step_name": "Host Keşfi",
             "tools": ["netdiscover_arp_scan", "nbtscan_netbios", "nmap_vuln_scan"]},
            {"step_key": "port_service_scan", "step_name": "Port ve Servis Taraması",
             "tools": ["nmap_vuln_scan", "masscan_port_scan"]},
        ],
    },
    {
        "workflow_key": "scan",
        "category_key": "web_discovery",
        "category_name": "Web Keşfi",
        "steps": [
            {"step_key": "tech_fingerprint", "step_name": "Teknoloji Tespiti",
             "tools": ["whatweb_fingerprint", "wafw00f_detect"]},
            {"step_key": "content_discovery", "step_name": "İçerik ve Dizin Keşfi",
             "tools": ["gobuster_dir_scan", "dirb_content_discovery", "ffuf_fuzz", "wfuzz_fuzz"]},
        ],
    },
    {
        "workflow_key": "scan",
        "category_key": "dns_osint",
        "category_name": "DNS ve OSINT",
        "steps": [
            {"step_key": "dns_enum", "step_name": "DNS Numaralandırma",
             "tools": ["dnsrecon_dns_enum", "dnsenum_dns_enum"]},
            {"step_key": "osint_gather", "step_name": "OSINT Toplama",
             "tools": ["theharvester_osint"]},
        ],
    },
    {
        "workflow_key": "scan",
        "category_key": "service_enum",
        "category_name": "Servis Numaralandırma",
        "steps": [
            {"step_key": "smb_netbios", "step_name": "SMB ve NetBIOS",
             "tools": ["smbclient_shares", "enum4linux_smb_enum", "nbtscan_netbios"]},
            {"step_key": "tls_audit", "step_name": "TLS/SSL Denetimi",
             "tools": ["sslscan_tls_audit"]},
        ],
    },
    # ===================== ATTACK =====================
    {
        "workflow_key": "attack",
        "category_key": "web_attack",
        "category_name": "Web Saldırı",
        "steps": [
            {"step_key": "web_vuln_scan", "step_name": "Web Zafiyet Taraması",
             "tools": ["nikto_web_scan", "nmap_vuln_scan"]},
            {"step_key": "sql_injection", "step_name": "SQL Injection",
             "tools": ["sqlmap_sqli"]},
        ],
    },
    {
        "workflow_key": "attack",
        "category_key": "credential_attack",
        "category_name": "Kimlik Saldırı",
        "steps": [
            {"step_key": "brute_force", "step_name": "Kimlik Brute-Force",
             "tools": ["hydra_bruteforce", "medusa_bruteforce"]},
        ],
    },
    {
        "workflow_key": "attack",
        "category_key": "exploitation",
        "category_name": "İstismar",
        "steps": [
            {"step_key": "metasploit_module", "step_name": "Metasploit Modülü",
             "tools": ["msf_module_run"]},
        ],
    },
    {
        "workflow_key": "attack",
        "category_key": "password_cracking",
        "category_name": "Parola Kırma",
        "steps": [
            {"step_key": "hash_crack", "step_name": "Hash Kırma",
             "tools": ["john_crack", "hashcat_crack"]},
        ],
    },
    # ===================== REMEDIATION (retest) =====================
    {
        "workflow_key": "remediation",
        "category_key": "revalidation",
        "category_name": "Yeniden Doğrulama",
        "steps": [
            {"step_key": "port_retest", "step_name": "Port/Servis Yeniden Testi",
             "tools": ["nmap_vuln_scan"]},
            {"step_key": "tls_retest", "step_name": "TLS Yeniden Testi",
             "tools": ["sslscan_tls_audit"]},
            {"step_key": "web_retest", "step_name": "Web Zafiyet Yeniden Testi",
             "tools": ["nikto_web_scan", "whatweb_fingerprint"]},
        ],
    },
    {
        "workflow_key": "remediation",
        "category_key": "fix_verification",
        "category_name": "Düzeltme Doğrulama",
        "steps": [
            {"step_key": "port_fix_verify", "step_name": "Port/Servis Düzeltme Doğrulama",
             "tools": ["nmap_remediation_verify"]},
            {"step_key": "web_fix_verify", "step_name": "Web Zafiyet Düzeltme Doğrulama",
             "tools": ["nikto_remediation_verify"]},
        ],
    },
    {
        "workflow_key": "remediation",
        "category_key": "hardening_verification",
        "category_name": "Sıkılaştırma Doğrulama",
        "steps": [
            {"step_key": "tls_hardening_verify", "step_name": "TLS/SSL Sıkılaştırma Doğrulama",
             "tools": ["sslscan_remediation_verify"]},
            {"step_key": "http_headers_verify", "step_name": "HTTP Güvenlik Başlıkları",
             "tools": ["curl_security_headers"]},
        ],
    },
]


def wipe_manual_catalog() -> dict:
    """Delete all manual catalog rows (keys restart from 1) and step scripts.

    Truncates only the manual 3YM tables — the YZO ai_operations tables are left
    untouched. validation_actions is also untouched (its step_id is nullable and
    has no FK, so history survives).
    """
    init_orchestrator_store()
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SET FOREIGN_KEY_CHECKS=0")
            for table in ("step_item_parameters", "step_items", "steps", "progress_categories"):
                cur.execute(f"TRUNCATE TABLE {table}")
            cur.execute("SET FOREIGN_KEY_CHECKS=1")
        conn.commit()

    # Clear on-disk step scripts (regenerated on seed).
    if _SCRIPT_DIR.exists():
        for child in _SCRIPT_DIR.iterdir():
            if child.is_dir():
                shutil.rmtree(child, ignore_errors=True)
            else:
                try:
                    child.unlink()
                except OSError:
                    pass
    return {"wiped": True}


def _seed_block(block: dict, operations: dict) -> int:
    """Create one catalog block (category + steps + items). Returns item count."""
    workflow_key = block["workflow_key"]
    category_key = block["category_key"]
    create_progress_category({
        "category_key": category_key,
        "display_name": block["category_name"],
        "workflow_key": workflow_key,
        "description": f"{block['category_name']} ({workflow_key}) manuel doğrulama adımları.",
        "is_active": True,
    })

    items = 0
    for step_spec in block["steps"]:
        step = create_step({
            "workflow_key": workflow_key,
            "category_key": category_key,
            "step_key": step_spec["step_key"],
            "display_name": step_spec["step_name"],
            "description": f"{step_spec['step_name']} — {block['category_name']}.",
            "is_active": True,
        })
        step_id = int(step["id"])

        for tool_key in step_spec["tools"]:
            op = operations.get(tool_key)
            if not op:
                continue
            item = create_step_item(step_id, {
                "item_type": "script",
                "item_key": op["operation_key"],
                "display_name": op["display_name"],
                "description": op["description"],
                "is_active": True,
            })
            item_id = int(item["id"])
            save_step_item_script_content(item_id, op["wrapper_source"])
            replace_step_item_parameters(item_id, op["params"])
            items += 1
    return items


def seed_manual_catalog() -> dict:
    """Build the tool-based manual catalog from MANUAL_CATALOG + tool specs."""
    init_orchestrator_store()
    operations = {op["operation_key"]: op for op in iter_operations()}

    categories = 0
    steps = 0
    items = 0
    for block in MANUAL_CATALOG:
        items += _seed_block(block, operations)
        categories += 1
        steps += len(block["steps"])

    return {"categories": categories, "steps": steps, "items": items}


def ensure_catalog_additions() -> dict:
    """Additively create any MANUAL_CATALOG categories missing from the DB.

    Non-destructive: leaves existing categories/steps/items (and any operator
    customizations) untouched, only appending category blocks whose category_key
    is not present yet. Lets new blocks (e.g. remediation) reach existing installs
    without a full rebuild.
    """
    init_orchestrator_store()
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT category_key FROM progress_categories")
            existing = {row["category_key"] for row in cur.fetchall() or []}

    operations = {op["operation_key"]: op for op in iter_operations()}
    added_categories = 0
    added_items = 0
    for block in MANUAL_CATALOG:
        if block["category_key"] in existing:
            continue
        added_items += _seed_block(block, operations)
        added_categories += 1

    return {"added_categories": added_categories, "added_items": added_items}


def rebuild_manual_catalog() -> dict:
    wipe = wipe_manual_catalog()
    seed = seed_manual_catalog()
    return {**wipe, **seed}


def refresh_manual_catalog() -> dict:
    """Re-save each existing manual step_item's wrapper script + parameters from
    the current tool specs, WITHOUT wiping the catalog (item ids stay stable, so
    active sessions are not disrupted). Use after a spec change to propagate new
    parameters to the 3YM side."""
    init_orchestrator_store()
    operations = {op["operation_key"]: op for op in iter_operations()}
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, item_key FROM step_items")
            rows = cur.fetchall() or []

    updated = 0
    for row in rows:
        op = operations.get(row["item_key"])
        if not op:
            continue
        save_step_item_script_content(int(row["id"]), op["wrapper_source"])
        replace_step_item_parameters(int(row["id"]), op["params"])
        updated += 1
    return {"updated": updated}


def count_manual_items() -> int:
    init_orchestrator_store()
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS c FROM step_items")
            row = cur.fetchone()
    return int(row["c"]) if row else 0


def ensure_manual_catalog_seeded() -> dict:
    """Seed the manual catalog on first run only (never auto-wipes existing data)."""
    if count_manual_items() > 0:
        return {"seeded": False, "skipped": True}
    return {"seeded": True, **seed_manual_catalog()}
