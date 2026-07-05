# Architecture

## Layers

```
Web UI (templates/*.html + static/js, static/css)
  ↓  HTTP (session cookie auth)
FastAPI routes (backend/routes/*)
  ↓
Services (backend/services/*)  ── AI (backend/ai/ollama_client.py)
  ↓                                 scanners (backend/scanner/*)
MySQL (backend/services/mysql_db.py)  +  on-disk wrapper scripts (data/*)
```

`main.py` only bootstraps the app + startup seeds. Routes hold HTTP endpoints,
services hold business logic, `ollama_client` wraps the local/cloud LLM,
`backend/scanner/*` wraps nmap/masscan/netdiscover.

## Pages (templates)
- `app.html` — the operation workspace (scan → 3YM direction flow / YZO orchestrator),
  left "stage tabs", `static/js/index.js` + `static/css/index.css`.
- `panel.html` — the Panel: users/roles, offers, the 3YM catalog editors
  ("İlerleme Kategorileri" + "Adım Listesi" with per-item params + Ace script
  editor), "Operasyon Test", the "Ön Bellek" (OSINT list) cache, and **"Pentest
  Kayıtları"** (history grouped by target + PDF/Word/print export). Admin-only tabs
  are gated in Jinja; "Pentest Kayıtları" also shows for test roles. Uses
  `static/js/settings.js` + `op_tester.js` + `pentest_records.js` + `static/css/settings.css`.
- `settings.html` — AI/scan/appearance settings + "Pentest Araçları" (tool
  install/update/remove + per-tool "Operasyon Özellikleri").

## Data model
- **Auth/config:** `users`, `roles`, `sessions`, `app_settings`, `offers`.
- **3YM (manual):** `progress_categories → steps → step_items → step_item_parameters`.
- **YZO (AI):** `ai_operations → ai_operation_params` (independent of 3YM).
- **History:** `validation_actions` (shared by both flows; grouped by target for
  the Pentest Kayıtları page).
- **Tool state cache:** `pentest_tools`.

## Tool execution
Tool operations are generated from `backend/services/pentest_tool_specs.py`
(single source, 23 tools). Each op is a Python **wrapper script** on disk that
builds an argv list (never a shell string), validates inputs, runs the binary,
streams output and emits an `SSVP_RESULT_JSON:` line. `validation_execution_store`
tracks runs (status/logs/cancel); `_run_script_execution_job` (validation_routes)
drives execution and records a `validation_actions` row.

## Pentest records & reporting
The Panel "Pentest Kayıtları" page groups `validation_actions` by target.
`orchestrator_store` provides `list_pentests` / `get_pentest_actions` /
`delete_validation_actions_for_target` (all take an optional `created_by` owner
filter — admins pass None, others their own id). `pentest_artifacts.py` links a
run to files it produced by matching `evidence.result` strings to real files under
`scans/` (path-traversal-safe). `pentest_report.py` renders a target's report as
HTML (browser print), **PDF** (xhtml2pdf; Turkish via an embedded DejaVuSans
`@font-face`) or **Word** (`python-docx`); all report text is stripped of
XML-illegal control chars.

## AI
`ollama_client` provides `evaluate_script_result`, `suggest_action_intents`, and
`orchestrate_next_operation`, all via `_ollama_chat` (json mode, think off) with
deterministic fallbacks. **The 3YM flow calls none of these** (AI-free by design).
