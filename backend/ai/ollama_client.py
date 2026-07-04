import json
import re

import requests

from backend.i18n import t
from backend.services.settings_store import DEFAULT_SETTINGS, get_app_settings


FAKE_AI_RESPONSE = {
    "summary": "Açık servis yüzeyi için kontrollü doğrulama akışı önerildi.",
    "actions": [
        {
            "action": "service_detection",
            "target": "authorized-target",
            "reason": "Servis sürümlerini doğrulayıp risk analizine girdi üretmek gerekiyor.",
            "parameters": {
                "scan_params": ["service-version", "default-scripts"],
                "scan_ports": ["22", "80", "443"],
            },
        },
        {
            "action": "port_discovery_fast",
            "target": "authorized-target",
            "reason": "Geniş port yüzeyini hızlı keşif ile yeniden doğrulamak gerekiyor.",
            "parameters": {
                "scan_params": ["rate-1000", "wait-2"],
                "scan_ports": ["all"],
            },
        },
    ],
}


def _get_language_label(language: str) -> str:
    return "English" if language == "en" else "Türkçe"


def _fake_ai_response(stage: str, target: str) -> dict:
    actions = []
    for action in FAKE_AI_RESPONSE["actions"]:
        copied = dict(action)
        copied["target"] = target or "authorized-target"
        actions.append(copied)

    return {
        "summary": f"[Demo] {stage} aşaması için AI action-intent önerileri üretildi.",
        "actions": actions,
    }


def _build_prompt(language: str, scan_result: dict, stage: str) -> str:
    ports_json = json.dumps(scan_result.get("ports", []), ensure_ascii=False, indent=2)
    hosts_json = json.dumps(scan_result.get("hosts", []), ensure_ascii=False, indent=2)
    target = scan_result.get("target", "authorized-target")

    return f"""
Sen {_get_language_label(language)} konuşan kıdemli bir siber güvenlik analistisin.
Bu analiz sadece izinli lab/sahip olunan sistemler içindir ve savunma amaçlıdır.

Gorev asamasi: {stage}

Aşağıdaki tarama sonucuna göre Action Intent listesi üret.
AI kesinlikle komut, binary path veya tool path döndürmez.
Sadece action intent döndürür.

Hedef:
{target}

Açık portlar:
{ports_json}

Host özeti:
{hosts_json}

Sadece şu JSON formatında cevap ver:
{{
  "summary": "Kısa savunma odaklı değerlendirme",
  "actions": [
    {{
      "action": "service_detection",
      "target": "{target}",
      "reason": "Bu action neden gerekli?",
      "parameters": {{
        "scan_params": ["service-version"],
        "scan_ports": ["22", "80"]
      }}
    }}
  ]
}}

Kurallar:
- action sadece bir action_key olmalı (örn: service_detection, port_discovery_fast, local_network_discovery).
- target sadece yetkili hedef metni olmalı.
- reason kısa, profesyonel, savunma odaklı olmalı.
- Zararlı exploit adımları veya saldırı talimatı verme.
- JSON dışında hiçbir metin döndürme.

Yanıtını {_get_language_label(language)} dilinde ver.
"""


def _extract_first_json_block(text: str) -> str | None:
    if not text:
        return None

    fenced = re.search(r"```json\s*(\{.*?\})\s*```", text, flags=re.DOTALL)
    if fenced:
        return fenced.group(1)

    first = text.find("{")
    last = text.rfind("}")
    if first == -1 or last == -1 or last <= first:
        return None
    return text[first:last + 1]


def _normalize_actions(raw_actions, target: str) -> list[dict]:
    actions: list[dict] = []
    for item in raw_actions or []:
        if not isinstance(item, dict):
            continue

        action = str(item.get("action") or "").strip().lower()
        if not action:
            continue

        action_target = str(item.get("target") or target or "authorized-target").strip()
        reason = str(item.get("reason") or "Action is required for validation.").strip()
        parameters = item.get("parameters") if isinstance(item.get("parameters"), dict) else {}

        actions.append(
            {
                "action": action,
                "target": action_target,
                "reason": reason,
                "parameters": parameters,
            }
        )

    return actions


def _parse_ai_payload(content: str, target: str, language: str) -> dict:
    json_text = _extract_first_json_block(content)
    if not json_text:
        return {
            "summary": t(language, "ai.noResponse", "Yorumlama yapılamadı."),
            "actions": [],
        }

    try:
        parsed = json.loads(json_text)
    except Exception:
        return {
            "summary": t(language, "ai.noResponse", "Yorumlama yapılamadı."),
            "actions": [],
        }

    summary = str(parsed.get("summary") or t(language, "ai.noResponse", "Yorumlama yapılamadı.")).strip()
    actions = _normalize_actions(parsed.get("actions"), target)
    return {
        "summary": summary,
        "actions": actions,
    }


def suggest_action_intents(scan_result: dict, stage: str = "validation_plan", language: str = "tr") -> dict:
    if scan_result.get("error"):
        return {
            "summary": t(language, "ai.scanFailed", "Tarama hatalı tamamlandığı için AI analizi yapılamadı."),
            "actions": [],
        }

    target = str(scan_result.get("target") or "authorized-target")

    settings = get_app_settings().get("ai", {})
    ai_defaults = DEFAULT_SETTINGS.get("ai", {})
    ollama_url = settings.get("ollama_url") or ai_defaults.get("ollama_url")
    model_name = settings.get("model_name") or ai_defaults.get("model_name")
    timeout_sec = int(settings.get("timeout_sec") or ai_defaults.get("timeout_sec") or 240)
    use_fake = bool(settings.get("use_fake_response", ai_defaults.get("use_fake_response", False)))

    if use_fake:
        return _fake_ai_response(stage, target)

    prompt = _build_prompt(language, scan_result, stage)

    try:
        response = requests.post(
            ollama_url,
            json={
                "model": model_name,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "stream": False
            },
            timeout=timeout_sec
        )

        response.raise_for_status()
        data = response.json()
        content = data.get("message", {}).get("content", "")
        return _parse_ai_payload(content, target, language)
    except Exception:
        return {
            "summary": t(language, "ai.noResponse", "Yorumlama yapılamadı."),
            "actions": [],
        }


def analyze_ports_with_ai(scan_result: dict, language: str = "tr") -> str:
    payload = suggest_action_intents(scan_result, stage="evidence_risk_analysis", language=language)
    summary = payload.get("summary") or t(language, "ai.noResponse", "Yorumlama yapılamadı.")
    actions = payload.get("actions") or []
    if not actions:
        return summary

    rendered = [summary, "", "Action Intents:"]
    for item in actions:
        rendered.append(
            f"- Action: {item.get('action')} | Target: {item.get('target')} | Reason: {item.get('reason')}"
        )

    return "\n".join(rendered)
