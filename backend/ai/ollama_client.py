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


def _fake_ai_response(stage: str, target: str, allowed_actions: list[str] | None = None) -> dict:
    allowed = {str(item).strip().lower() for item in (allowed_actions or []) if str(item).strip()}
    actions = []
    for action in FAKE_AI_RESPONSE["actions"]:
        action_key = str(action.get("action") or "").strip().lower()
        if allowed and action_key not in allowed:
            continue

        copied = dict(action)
        copied["target"] = target or "authorized-target"
        actions.append(copied)

    return {
        "summary": f"[Demo] {stage} aşaması için AI action-intent önerileri üretildi.",
        "actions": actions,
    }


def _build_prompt(language: str, scan_result: dict, stage: str, allowed_actions: list[str] | None = None) -> str:
    ports_json = json.dumps(scan_result.get("ports", []), ensure_ascii=False, indent=2)
    hosts_json = json.dumps(scan_result.get("hosts", []), ensure_ascii=False, indent=2)
    evidence_json = json.dumps(scan_result.get("evidence", []), ensure_ascii=False, indent=2)
    workflow_step = scan_result.get("workflow_step") if isinstance(scan_result.get("workflow_step"), dict) else {}
    stage_tools = scan_result.get("stage_tools") if isinstance(scan_result.get("stage_tools"), list) else []
    step_name = workflow_step.get("step_name") or stage
    step_desc = workflow_step.get("description") or ""
    step_hint = workflow_step.get("ai_prompt_hint") or ""
    target = scan_result.get("target", "authorized-target")
    allowed_actions = [str(item).strip().lower() for item in (allowed_actions or []) if str(item).strip()]
    allowed_actions_json = json.dumps(allowed_actions, ensure_ascii=False)
    stage_tools_json = json.dumps(stage_tools, ensure_ascii=False, indent=2)

    return f"""
Sen {_get_language_label(language)} konuşan kıdemli bir siber güvenlik analistisin.
Bu analiz sadece izinli lab/sahip olunan sistemler içindir ve savunma amaçlıdır.

Gorev asamasi: {stage}
Asama adi: {step_name}
Asama aciklamasi: {step_desc}
Asama AI notu: {step_hint}

Aşağıdaki tarama sonucuna göre Action Intent listesi üret.
AI kesinlikle komut, binary path veya tool path döndürmez.
Sadece action intent döndürür.

Hedef:
{target}

Açık portlar:
{ports_json}

Host özeti:
{hosts_json}

Evidence:
{evidence_json}

Asama icin tanimli tool katalogu (action + kategori + adim):
{stage_tools_json}

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
- action sadece bu listeden secilmeli: {allowed_actions_json}
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


def suggest_action_intents(
    scan_result: dict,
    stage: str = "scan",
    language: str = "tr",
    allowed_actions: list[str] | None = None,
) -> dict:
    if scan_result.get("error"):
        return {
            "summary": t(language, "ai.scanFailed", "Tarama hatalı tamamlandığı için AI analizi yapılamadı."),
            "actions": [],
        }

    target = str(scan_result.get("target") or "authorized-target")

    settings = get_app_settings().get("ai", {})
    ai_defaults = DEFAULT_SETTINGS.get("ai", {})
    use_fake = bool(settings.get("use_fake_response", ai_defaults.get("use_fake_response", False)))

    if use_fake:
        return _fake_ai_response(stage, target, allowed_actions=allowed_actions)

    prompt = _build_prompt(language, scan_result, stage, allowed_actions=allowed_actions)
    content = _ollama_chat(prompt, expect_json=True, num_predict=900)
    if not content:
        return {
            "summary": t(language, "ai.noResponse", "Yorumlama yapılamadı."),
            "actions": [],
        }
    return _parse_ai_payload(content, target, language)


def analyze_ports_with_ai(scan_result: dict, language: str = "tr") -> str:
    payload = suggest_action_intents(scan_result, stage="scan", language=language)
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


_VALID_EVAL_RISK = {"low", "medium", "high", "critical"}


def _ollama_chat(prompt: str, *, expect_json: bool = True, num_predict: int = 800) -> str | None:
    """Send a single-user-message chat request to Ollama; return content or None.

    Reasoning models (e.g. qwen3) otherwise spend minutes emitting a hidden
    chain-of-thought before the answer, which pushes every call past the request
    timeout and forces a fallback. We disable thinking, pin ``format=json`` when
    a JSON answer is expected and cap ``num_predict`` so a result-evaluation call
    returns in seconds instead of ~3 minutes. If the backend rejects ``think``
    (older Ollama or a non-reasoning model) we retry once without it.
    """
    settings = get_app_settings().get("ai", {})
    ai_defaults = DEFAULT_SETTINGS.get("ai", {})
    ollama_url = settings.get("ollama_url") or ai_defaults.get("ollama_url")
    model_name = settings.get("model_name") or ai_defaults.get("model_name")
    timeout_sec = int(settings.get("timeout_sec") or ai_defaults.get("timeout_sec") or 240)

    base_body = {
        "model": model_name,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "options": {"temperature": 0, "num_predict": int(num_predict)},
    }
    if expect_json:
        base_body["format"] = "json"

    def _post(body: dict) -> str:
        response = requests.post(ollama_url, json=body, timeout=timeout_sec)
        response.raise_for_status()
        return response.json().get("message", {}).get("content", "")

    try:
        return _post({**base_body, "think": False})
    except requests.exceptions.HTTPError:
        # Backend may not understand the `think` flag; retry once without it.
        try:
            return _post(base_body)
        except Exception:
            return None
    except Exception:
        return None


# Backwards-compatible alias for the evaluation path.
def _call_ollama_chat(prompt: str) -> str | None:
    return _ollama_chat(prompt, expect_json=True, num_predict=800)


def _fallback_result_evaluation(*, step: dict, action_key: str, target: str, process_logs: list[str], script_result: dict, language: str) -> dict:
    """Deterministic evaluation used when the AI backend is unavailable."""
    success = bool(isinstance(script_result, dict) and script_result.get("ok", False))
    workflow_key = str(step.get("workflow_key") or "scan").strip().lower()
    next_stage = {"scan": "attack", "attack": "remediation", "remediation": "remediation"}.get(workflow_key, "remediation")
    last_log = process_logs[-1] if process_logs else "-"

    if language == "en":
        summary = (
            f"Script '{action_key}' finished with status "
            f"{'success' if success else 'failure'} on target {target}. "
            f"Last log line: {last_log}."
        )
        steps = ["Review the collected evidence.", f"Prepare the {next_stage} stage inputs."]
    else:
        summary = (
            f"'{action_key}' scripti {target} hedefinde "
            f"{'basarili' if success else 'basarisiz'} tamamlandi. "
            f"Son log: {last_log}."
        )
        steps = ["Toplanan kaniti gozden gecir.", f"{next_stage} asamasi girdilerini hazirla."]

    return {
        "engine": "fallback",
        "success": success,
        "risk_level": "low" if success else "medium",
        "summary": summary,
        "findings": [],
        "reasoning": "AI servisine ulasilamadi; kural tabanli ozet uretildi.",
        "recommended_next_steps": steps,
        "next_stage": next_stage,
    }


def _build_result_eval_prompt(*, language: str, step: dict, action_key: str, target: str, process_logs: list[str], script_result: dict) -> str:
    logs_json = json.dumps(process_logs[-40:], ensure_ascii=False, indent=2)
    result_json = json.dumps(script_result, ensure_ascii=False, indent=2)
    step_name = step.get("step_name") or step.get("step_key") or "-"
    workflow_key = step.get("workflow_key") or "scan"

    return f"""
Sen {_get_language_label(language)} konusan kidemli bir siber guvenlik analistisin.
Bu degerlendirme yalnizca izinli lab/sahip olunan sistemler icin, savunma amaclidir.

Bir dogrulama scripti calisti ve sonuc uretti. Gorevin bu SONUCU degerlendirmek.
Yeni komut/exploit uretme; sadece sonucu yorumla ve bir sonraki savunma adimini oner.

Asama: {step_name} (workflow: {workflow_key})
Action: {action_key}
Hedef: {target}

Script process loglari:
{logs_json}

Script sonuc JSON:
{result_json}

Sadece su JSON formatinda cevap ver:
{{
  "success": true,
  "risk_level": "low|medium|high|critical",
  "summary": "Sonucun kisa savunma odakli degerlendirmesi",
  "findings": ["bulgu 1", "bulgu 2"],
  "reasoning": "Neden bu risk seviyesi ve bu bulgular",
  "recommended_next_steps": ["somut sonraki adim"],
  "next_stage": "attack|remediation|scan"
}}

Kurallar:
- risk_level sadece: low, medium, high, critical.
- JSON disinda hicbir metin dondurme.
- Yanitini {_get_language_label(language)} dilinde ver.
"""


def evaluate_script_result(
    *,
    step: dict,
    action_key: str,
    target: str,
    process_logs: list[str],
    script_result: dict,
    language: str = "tr",
) -> dict:
    """Ask the AI to assess a script's execution result (Requirement: AI evaluates script output).

    Returns a structured evaluation and always falls back to a deterministic
    summary if the AI backend is unavailable or returns unparsable content.
    """
    process_logs = [str(item) for item in (process_logs or [])]
    script_result = script_result if isinstance(script_result, dict) else {"raw": script_result}

    settings = get_app_settings().get("ai", {})
    ai_defaults = DEFAULT_SETTINGS.get("ai", {})
    use_fake = bool(settings.get("use_fake_response", ai_defaults.get("use_fake_response", False)))
    if use_fake:
        return _fallback_result_evaluation(
            step=step, action_key=action_key, target=target,
            process_logs=process_logs, script_result=script_result, language=language,
        )

    prompt = _build_result_eval_prompt(
        language=language, step=step, action_key=action_key,
        target=target, process_logs=process_logs, script_result=script_result,
    )
    content = _call_ollama_chat(prompt)
    if not content:
        return _fallback_result_evaluation(
            step=step, action_key=action_key, target=target,
            process_logs=process_logs, script_result=script_result, language=language,
        )

    json_text = _extract_first_json_block(content)
    parsed = None
    if json_text:
        try:
            parsed = json.loads(json_text)
        except Exception:
            parsed = None

    if not isinstance(parsed, dict):
        fallback = _fallback_result_evaluation(
            step=step, action_key=action_key, target=target,
            process_logs=process_logs, script_result=script_result, language=language,
        )
        fallback["engine"] = "ai_unparsable"
        fallback["raw_response"] = str(content)[:2000]
        return fallback

    workflow_key = str(step.get("workflow_key") or "scan").strip().lower()
    default_next = {"scan": "attack", "attack": "remediation", "remediation": "remediation"}.get(workflow_key, "remediation")
    risk_level = str(parsed.get("risk_level") or "low").strip().lower()
    if risk_level not in _VALID_EVAL_RISK:
        risk_level = "low"

    findings = parsed.get("findings")
    findings = [str(item).strip() for item in findings if str(item).strip()] if isinstance(findings, list) else []
    next_steps = parsed.get("recommended_next_steps")
    next_steps = [str(item).strip() for item in next_steps if str(item).strip()] if isinstance(next_steps, list) else []

    return {
        "engine": "ai",
        "success": bool(parsed.get("success", script_result.get("ok", False))),
        "risk_level": risk_level,
        "summary": str(parsed.get("summary") or "").strip() or t(language, "ai.noResponse", "Yorumlama yapilamadi."),
        "findings": findings,
        "reasoning": str(parsed.get("reasoning") or "").strip(),
        "recommended_next_steps": next_steps,
        "next_stage": str(parsed.get("next_stage") or default_next).strip().lower(),
    }


def analyze_evidence_with_ai(target: str, evidence: list[dict], language: str = "tr") -> dict:
    scan_result = {
        "target": target,
        "ports": [],
        "hosts": [],
        "evidence": evidence,
        "workflow_step": {
            "step_name": "Remediation Plan",
            "description": "Evidence ve risk bulgularindan duzeltme plani uret.",
            "ai_prompt_hint": "Somut hardening adimlari, oncelik sirasi, retest kriteri.",
        },
    }
    return suggest_action_intents(scan_result, stage="remediation", language=language)
