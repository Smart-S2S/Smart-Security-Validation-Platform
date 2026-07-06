import contextvars
import json
import re
import time

import requests

from backend.i18n import t
from backend.services.settings_store import DEFAULT_SETTINGS


# Per-user AI settings override. AI settings are per-user: a request handler (or a
# background job) sets the requesting user's resolved AI config here, and every AI
# call in that context uses it instead of the global default. When unset, calls
# fall back to the global app settings (backward compatible). contextvars keep
# this isolated per request/thread, so concurrent users never see each other's
# provider/keys.
_AI_SETTINGS_OVERRIDE: "contextvars.ContextVar[dict | None]" = contextvars.ContextVar(
    "ssvp_ai_settings_override", default=None
)


def set_ai_settings_override(settings: dict | None) -> None:
    """Set (or clear with None/empty) the AI settings for the current context."""
    _AI_SETTINGS_OVERRIDE.set(settings if settings else None)


def _effective_ai_settings() -> dict:
    override = _AI_SETTINGS_OVERRIDE.get()
    if override:
        return override
    # No per-user override in this context → the install-time local-AI default
    # (never the global app_settings row, which is no longer used for AI).
    return DEFAULT_SETTINGS.get("ai", {})


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

    settings = _effective_ai_settings()
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
    """Send a single-user-message chat request to the configured AI and return content.

    Dispatches to the local Ollama backend or a remote/cloud API based on
    ``ai.provider`` in settings. Every higher-level AI helper routes through here,
    so switching provider in Settings switches the whole platform. Returns None on
    any failure so callers fall back to their deterministic paths.
    """
    settings = _effective_ai_settings()
    ai_defaults = DEFAULT_SETTINGS.get("ai", {})
    provider = str(settings.get("provider") or ai_defaults.get("provider") or "local").strip().lower()

    if provider == "cloud":
        return _cloud_chat(settings, ai_defaults, prompt, expect_json=expect_json, num_predict=num_predict)
    return _local_ollama_chat(settings, ai_defaults, prompt, expect_json=expect_json, num_predict=num_predict)


def _local_ollama_chat(settings: dict, ai_defaults: dict, prompt: str, *, expect_json: bool, num_predict: int) -> str | None:
    """Local Ollama chat. Disables reasoning `think` and pins `format=json` so a
    result-evaluation call returns in seconds instead of minutes; retries once
    without `think` if the backend rejects that flag."""
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
        try:
            return _post(base_body)
        except Exception:
            return None
    except Exception:
        return None


def _cloud_chat(settings: dict, ai_defaults: dict, prompt: str, *, expect_json: bool, num_predict: int) -> str | None:
    """Remote/cloud chat: OpenAI-compatible (default) or Anthropic messages API.

    OpenAI-compatible covers OpenAI plus most gateways/self-hosted servers
    (LiteLLM, LocalAI, Groq, Together, vLLM, …). The API key is sent per that
    API's auth header. On a JSON-format rejection it retries once without
    response_format so stricter-but-non-JSON-capable endpoints still work.
    """
    url = str(settings.get("cloud_api_url") or "").strip()
    api_key = str(settings.get("cloud_api_key") or "").strip()
    model = str(settings.get("cloud_model") or "").strip()
    fmt = str(settings.get("cloud_format") or "openai").strip().lower()
    timeout_sec = int(settings.get("timeout_sec") or ai_defaults.get("timeout_sec") or 300)

    if not url or not model:
        return None

    try:
        if fmt == "anthropic":
            headers = {
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            }
            body = {
                "model": model,
                "max_tokens": int(num_predict),
                "messages": [{"role": "user", "content": prompt}],
            }
            response = requests.post(url, json=body, headers=headers, timeout=timeout_sec)
            response.raise_for_status()
            blocks = response.json().get("content") or []
            return "".join(b.get("text", "") for b in blocks if isinstance(b, dict))

        # OpenAI-compatible chat completions
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        base_body = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0,
            "max_tokens": int(num_predict),
        }

        def _post(body: dict) -> str:
            response = requests.post(url, json=body, headers=headers, timeout=timeout_sec)
            response.raise_for_status()
            choices = response.json().get("choices") or [{}]
            return choices[0].get("message", {}).get("content", "")

        if expect_json:
            try:
                return _post({**base_body, "response_format": {"type": "json_object"}})
            except requests.exceptions.HTTPError:
                return _post(base_body)
        return _post(base_body)
    except Exception:
        return None


# Backwards-compatible alias for the evaluation path.
def _call_ollama_chat(prompt: str) -> str | None:
    return _ollama_chat(prompt, expect_json=True, num_predict=800)


def test_ai_connection() -> dict:
    """Make one minimal real AI call with the SAVED settings and surface the
    actual outcome (unlike `_ollama_chat`, which swallows errors to None).

    Returns {ok, provider, model, message, detail?, status?, latency_ms?} so the
    Settings UI can tell the operator exactly why a call fails (quota, wrong
    model, bad key, unreachable host) instead of silently falling back.
    """
    settings = _effective_ai_settings()
    ai_defaults = DEFAULT_SETTINGS.get("ai", {})
    provider = str(settings.get("provider") or ai_defaults.get("provider") or "local").strip().lower()
    # Cap the test wait so the UI never hangs on a slow local model.
    timeout_sec = min(int(settings.get("timeout_sec") or ai_defaults.get("timeout_sec") or 60), 60)
    prompt = 'Reply ONLY with compact JSON: {"ok": true}'

    if bool(settings.get("use_fake_response")):
        return {"ok": True, "provider": "demo", "message": "Demo yaniti aktif; gercek AI cagrilmadi."}

    def _error_detail(response) -> str:
        try:
            data = response.json()
            err = data.get("error")
            if isinstance(err, dict):
                return str(err.get("message") or err)
            if err:
                return str(err)
            return json.dumps(data, ensure_ascii=False)[:400]
        except Exception:
            return (response.text or "")[:400]

    started = time.time()
    try:
        if provider == "cloud":
            url = str(settings.get("cloud_api_url") or "").strip()
            model = str(settings.get("cloud_model") or "").strip()
            fmt = str(settings.get("cloud_format") or "openai").strip().lower()
            api_key = str(settings.get("cloud_api_key") or "").strip()
            if not url or not model:
                return {"ok": False, "provider": "cloud", "message": "API adresi veya model bos. Once kaydedin."}
            if fmt == "anthropic":
                headers = {"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"}
                body = {"model": model, "max_tokens": 20, "messages": [{"role": "user", "content": prompt}]}
            else:
                headers = {"Content-Type": "application/json"}
                if api_key:
                    headers["Authorization"] = f"Bearer {api_key}"
                body = {"model": model, "max_tokens": 20, "temperature": 0, "messages": [{"role": "user", "content": prompt}]}
            response = requests.post(url, json=body, headers=headers, timeout=timeout_sec)
        else:
            url = settings.get("ollama_url") or ai_defaults.get("ollama_url")
            model = settings.get("model_name") or ai_defaults.get("model_name")
            body = {
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
                "options": {"num_predict": 20, "temperature": 0},
            }
            response = requests.post(url, json={**body, "think": False}, timeout=timeout_sec)
            if response.status_code == 400:
                # Model may not accept the `think` flag; retry without it.
                response = requests.post(url, json=body, timeout=timeout_sec)

        latency_ms = int((time.time() - started) * 1000)
        if response.status_code >= 400:
            return {
                "ok": False,
                "provider": provider,
                "model": model,
                "status": response.status_code,
                "message": f"HTTP {response.status_code}",
                "detail": _error_detail(response),
            }
        return {
            "ok": True,
            "provider": provider,
            "model": model,
            "latency_ms": latency_ms,
            "message": f"Baglanti basarili ({latency_ms} ms).",
        }
    except requests.exceptions.Timeout:
        return {"ok": False, "provider": provider, "message": f"Zaman asimi ({timeout_sec}s). Adres/erisim dogru mu?"}
    except requests.exceptions.ConnectionError:
        # The endpoint refused/could not be reached. For local this almost always
        # means the Ollama service is stopped (e.g. an admin turned it off from
        # Settings > Servisler). Give a plain-language hint instead of a raw
        # HTTPConnectionPool traceback.
        if provider == "cloud":
            return {
                "ok": False,
                "provider": provider,
                "message": "Bulut AI adresine ulasilamadi. API adresini ve sunucunun internet erisimini kontrol edin.",
            }
        return {
            "ok": False,
            "provider": provider,
            "message": (
                "Yerel yapay zeka (Ollama) su an calismiyor. Yonetici servisi kapatmis olabilir. "
                "Yoneticiden Ollama'yi baslatmasini isteyin ya da AI Model ayarlarindan Bulut saglayiciya gecin."
            ),
        }
    except Exception as exc:
        return {"ok": False, "provider": provider, "message": "Baglanti kurulamadi.", "detail": f"{type(exc).__name__}: {str(exc)[:300]}"}


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

    settings = _effective_ai_settings()
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


_ORCHESTRATION_STAGES = ("scan", "attack", "remediation")


def _fallback_orchestration(*, target: str, history: list[dict], catalog: list[dict], preferred_stage: str, language: str) -> dict:
    """Deterministic next-operation plan used when the AI backend is unavailable."""
    done_stages = {str(h.get("stage") or "").strip().lower() for h in history}
    stage = str(preferred_stage or "").strip().lower()
    if stage not in _ORCHESTRATION_STAGES:
        # Advance to the first stage that has not produced any action yet.
        stage = next((s for s in _ORCHESTRATION_STAGES if s not in done_stages), "scan")

    operations = [
        {"action": entry.get("action"), "step_key": entry.get("step_key"), "reason": entry.get("description") or "Dogrulama adimi", "parameters": {}}
        for entry in catalog
        if str(entry.get("stage") or "").strip().lower() == stage
    ]

    if language == "en":
        plan = f"Rule-based plan: run the {stage} stage validations for {target}."
    else:
        plan = f"Kural tabanli plan: {target} icin {stage} asamasi dogrulamalarini calistir."

    return {
        "engine": "fallback",
        "stage": stage,
        "plan": plan,
        "summary": plan,
        "done": not operations,
        "operations": operations,
    }


def _build_orchestration_prompt(*, language: str, target: str, history: list[dict], catalog: list[dict], user_instruction: str, preferred_stage: str, allowed_stages: list[str] | None = None) -> str:
    history_json = json.dumps(history[-12:], ensure_ascii=False, indent=2)
    catalog_json = json.dumps(catalog, ensure_ascii=False, indent=2)
    instruction = (user_instruction or "").strip() or "-"
    preferred = (preferred_stage or "").strip().lower() or "-"
    allowed = ", ".join(allowed_stages or []) or "-"

    return f"""
Sen {_get_language_label(language)} konusan kidemli bir siber guvenlik dogrulama orkestratorusun.
Bu calisma yalnizca izinli lab/sahip olunan sistemler icin ve savunma amaclidir.

Gorevin: hedef icin bir sonraki DOGRULAMA adimini planlamak. Asamalar sirasi:
scan (tarama/kesif) -> attack (yetkili aktif dogrulama) -> remediation (duzeltme/retest).
Simdiye kadar yapilan islemlerin sonuclarina bakarak mantikli bir sonraki adimi sec.
Yeni komut/exploit URETME; sadece asagidaki katalogdan gecerli action'lari sec.

YETKI KISITI: Bu kullanicinin yetkili oldugu asamalar SADECE: {allowed}.
Bu listede olmayan bir asamada (ornegin yetki yoksa attack) KESINLIKLE islem onerme;
kullanici istese bile reddet ve done=true dondur. Katalogda zaten sadece izinli
asamalarin action'lari var.

Hedef: {target}
Kullanici tercihi (asama, opsiyonel): {preferred}
Kullanici talimati/onerisi (varsa dikkate al): {instruction}

Simdiye kadarki islem gecmisi ve sonuclari:
{history_json}

Secebilecegin islem katalogu (yalnizca buradaki action + step_key ciftlerini kullan).
Her katalog kaydinda su alanlar var:
- "when_to_use": bu operasyonun ne zaman/neden uygun oldugunu anlatir; kararini buna gore ver.
- "installed": arac sunucuda kurulu mu (true/false). Mumkunse kurulu araclari onceliklendir.
- "params": operasyonun girdileri; "ad*" zorunlu, "ad=secim1|secim2" ise secim listesidir.
Katalog:
{catalog_json}

Sadece su JSON formatinda cevap ver:
{{
  "stage": "scan|attack|remediation",
  "plan": "Bu adimda ne yapilacaginin kisa savunma odakli aciklamasi",
  "done": false,
  "operations": [
    {{
      "action": "katalogdaki_action_key",
      "step_key": "katalogdaki_step_key",
      "reason": "Bu islem neden simdi gerekli",
      "parameters": {{}}
    }}
  ]
}}

Kurallar:
- operations sadece katalogdaki action/step_key ciftlerinden secilmeli.
- Once "when_to_use" ve simdiye kadarki sonuclara bakarak en mantikli operasyonu sec; gereksiz/erken adim onerme.
- Tum asamalar tamamlandiysa veya yapilacak anlamli islem kalmadiysa done=true ve operations=[] dondur.
- parameters alanini "params" ipuclarina gore MANTIKLI degerlerle DOLDUR: hedef/host/url alanlarina hedefi, port/rport alanlarina onceki sonuclardan cikan portlari, secim listesi olan alanlara listeden bir deger, wordlist gibi alanlara tipik degerleri yaz. Emin olmadigin bir alani bos birak; sistem hedeften makul varsayilan uretir.
- JSON disinda hicbir metin dondurme.
- Yanitini {_get_language_label(language)} dilinde ver.
"""


def orchestrate_next_operation(
    *,
    target: str,
    history: list[dict],
    catalog: list[dict],
    user_instruction: str = "",
    preferred_stage: str = "",
    allowed_stages: list[str] | None = None,
    language: str = "tr",
) -> dict:
    """Let the AI choose the next validation stage + operations for a target.

    Returns ``{engine, stage, plan, summary, done, operations[]}``. Operations
    reference existing catalog ``action``/``step_key`` pairs so the caller can
    build executable intents. Always falls back to a deterministic stage plan
    when the AI backend is unavailable or returns unusable content.
    """
    history = [h for h in (history or []) if isinstance(h, dict)]
    catalog = [c for c in (catalog or []) if isinstance(c, dict)]
    # The catalog is pre-filtered to the caller's authorised stages; derive the
    # allowed set from it so a role can never be widened here.
    catalog_stages = {str(c.get("stage") or "").strip().lower() for c in catalog if c.get("stage")}
    allowed_stages = sorted(catalog_stages & {str(s).strip().lower() for s in (allowed_stages or catalog_stages)})
    if not allowed_stages:
        allowed_stages = sorted(catalog_stages)
    stage_of_action = {
        str(c.get("action") or "").strip().lower(): str(c.get("stage") or "").strip().lower()
        for c in catalog
    }
    valid_pairs = {
        (str(c.get("action") or "").strip().lower(), str(c.get("step_key") or "").strip().lower())
        for c in catalog
    }
    valid_actions = {action for action, _ in valid_pairs}

    settings = _effective_ai_settings()
    ai_defaults = DEFAULT_SETTINGS.get("ai", {})
    use_fake = bool(settings.get("use_fake_response", ai_defaults.get("use_fake_response", False)))
    if use_fake:
        return _fallback_orchestration(
            target=target, history=history, catalog=catalog,
            preferred_stage=preferred_stage, language=language,
        )

    prompt = _build_orchestration_prompt(
        language=language, target=target, history=history, catalog=catalog,
        user_instruction=user_instruction, preferred_stage=preferred_stage,
        allowed_stages=allowed_stages,
    )
    content = _ollama_chat(prompt, expect_json=True, num_predict=900)
    parsed = None
    if content:
        json_text = _extract_first_json_block(content)
        if json_text:
            try:
                parsed = json.loads(json_text)
            except Exception:
                parsed = None

    if not isinstance(parsed, dict):
        fallback = _fallback_orchestration(
            target=target, history=history, catalog=catalog,
            preferred_stage=preferred_stage, language=language,
        )
        fallback["engine"] = "fallback" if not content else "ai_unparsable"
        return fallback

    stage = str(parsed.get("stage") or "").strip().lower()
    if stage not in _ORCHESTRATION_STAGES:
        stage = str(preferred_stage or "scan").strip().lower()
        if stage not in _ORCHESTRATION_STAGES:
            stage = "scan"

    # Keep only operations that map to a real catalog entry; recover the
    # step_key from the catalog when the model omits or mismatches it.
    step_key_by_action: dict[str, str] = {}
    for c in catalog:
        action = str(c.get("action") or "").strip().lower()
        if action and action not in step_key_by_action:
            step_key_by_action[action] = str(c.get("step_key") or "").strip().lower()

    operations: list[dict] = []
    for op in parsed.get("operations") or []:
        if not isinstance(op, dict):
            continue
        action = str(op.get("action") or "").strip().lower()
        if action not in valid_actions:
            continue
        # Belt-and-suspenders: never emit an operation outside the allowed stages.
        if stage_of_action.get(action) not in allowed_stages:
            continue
        step_key = str(op.get("step_key") or "").strip().lower()
        if (action, step_key) not in valid_pairs:
            step_key = step_key_by_action.get(action, "")
        parameters = op.get("parameters") if isinstance(op.get("parameters"), dict) else {}
        operations.append({
            "action": action,
            "step_key": step_key,
            "reason": str(op.get("reason") or "").strip() or "Dogrulama adimi",
            "parameters": parameters,
        })

    plan = str(parsed.get("plan") or "").strip()
    done = bool(parsed.get("done", False)) or not operations

    return {
        "engine": "ai",
        "stage": stage,
        "plan": plan or t(language, "ai.noResponse", "Yorumlama yapilamadi."),
        "summary": plan,
        "done": done,
        "operations": operations,
    }
