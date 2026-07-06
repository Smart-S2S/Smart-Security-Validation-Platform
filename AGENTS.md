# SSVP Agent Contract

Defensive Security Validation platform. **Read this before changing anything** —
it captures the current architecture so a fresh session can continue safely.

## Mission Boundaries
- Defensive use only; authorized pentest in owned/lab systems only.
- No third-party attack operations, no destructive actions outside an approved lab
  workflow. Focus: validation, hardening, remediation, retest, reporting.

## Two independent flows (DO NOT merge or cross-wire them)
1. **3YM — manual 3-way** (`scan/attack/remediation`). **NEVER sends any AI prompt.**
   Tables: `progress_categories → steps → step_items → step_item_parameters`.
   Endpoints: `/validation/workflow-steps`, `/validation/step-scripts` (AI-free
   loader), `/validation/execute-intent`. Catalog editors live on the Panel page.
2. **YZO — AI Orchestrator.** LLM picks stage+operation turn by turn.
   Tables: `ai_operations → ai_operation_params` (separate from 3YM).
   Endpoints: `/validation/ai-orchestrate`, `/validation/ai-execute-intent`.

Changing one flow must not touch the other. When a prompt says "3YM", do not use
`ai_operations`/AI; when it says "YZO", do not touch the manual `step_items` tables.

## Tool specs — single source of truth
- `backend/services/pentest_tool_specs.py` holds ALL 23 tool definitions (~258
  params) via `P(...)` entries. `build_argv` is generic and **argv-list only, no
  shell**; every value is regex-validated. `positionals_first` (dirb) and
  `fixed_pre` (gobuster `dir`) control argv shape; default is `tool [opts] positionals`.
- `iter_operations()` yields the normalized ops that BOTH catalogs seed from —
  so they stay identical per tool. `build_wrapper_source(tool)` renders the runnable
  wrapper. `WHEN_TO_USE` gives the YZO an AI hint per operation.
- After editing specs, re-seed BOTH: `python -m scripts.seed_ai_operations` (YZO,
  upsert) + `manual_catalog_store.refresh_manual_catalog()` (3YM, in-place, ids
  stable). `seed_manual_catalog.py` WIPES the 3YM catalog — use `refresh_` to avoid
  id churn / disrupting active sessions.

## Intent format (both flows)
Backend builds fully-prefilled, executable intents; the AI only supplies an
`action`/`preferred_action` and optional `parameters`. An intent carries:
`action`, `step_key` (3YM) or `operation_key` + `ai_operation:true` (YZO),
`target`, `reason`, `parameters` (prefilled), `parameter_schema` (rich, editable).
The frontend renders `parameter_schema` (basic + collapsible "Gelişmiş" via
`sort_order >= 500`) and runs manual intents through `execute-intent`, YZO intents
through `ai-execute-intent`.

## Approval Policy
Active validation/attack actions require explicit user approval; the user edits
parameters in the UI first; the backend enforces the approval check. YZO runs one
turn per "Onayla ve Çalıştır" and rolls into a new tab afterward.

## Pentest records (Panel → "Pentest Kayıtları")
`validation_actions` grouped **one pentest = one target**. Visible to admins + any
`test`/`attack`/`remediation` role. **Ownership is enforced on every endpoint:**
admins see all, everyone else only their own (`created_by`) — thread the
`created_by` filter through `list_pentests` / `get_pentest_actions` /
`delete_validation_actions_for_target` (`_pentest_owner_filter(current_user)` in
`validation_routes`). Endpoints: `/validation/pentests[/detail|/delete|/file-delete|
/file-download|/report]`. Cascade delete removes rows + the scan files they
produced. `pentest_artifacts.py` links files by matching `evidence.result` strings
to real files under `scans/` (path-traversal-safe — never trust a raw name).
`pentest_report.py` builds HTML/PDF/Word; **PDF Turkish needs the DejaVuSans
`@font-face`** (a bare font-family name silently drops ş/ğ/ı/İ), and all report
text must pass through `_clean()` (python-docx rejects XML-illegal control chars).
Deps: `xhtml2pdf`, `python-docx` (in `requirements.txt`).

## Accounts, DB credentials & backups
- **Roles:** `user_management`, `test`, `attack`, `remediation`; admins bypass role
  checks. `require_roles()` with no role only requires *authenticated* — admin-only
  endpoints must ALSO check `is_admin` in the body (see `_require_admin`); keep this
  pattern when adding endpoints.
- **Provisioning:** `install.py` creates a dedicated admin (`provision_admin_user`,
  all roles, `must_change_password=False`) with a generated password and disables
  the default `admin/admin` (`set_active_by_username('admin', False)`).
- **DB credentials** come from `db_credentials.py` (defaults < env < `data/
  db_config.json`; file wins so runtime rotation persists). `mysql_db._mysql_config`
  reads it. The systemd unit sets `SSVP_DB_CONFIG` and does NOT bake in the password.
- **`db_admin.py`** (Settings → Veritabanı ve Yedekleme, admin-only): rotates the
  password verify-then-persist with rollback (no downtime), and makes/lists/deletes
  `mysqldump` backups under `data/backups/` (password via `MYSQL_PWD`, never argv).
  `data/db_config.json` + `data/backups/` are git-ignored.

## Security invariants (do not regress)
- Never build a shell command string; always an argv list, no `shell=True`.
- Tool install/update stays parameter-free (allowlisted tool→package only).
- Every operation parameter passes `_validate` (regex allowlist, reject leading `-`)
  or a fixed `choices`/flag allowlist before reaching a binary.
- Script/catalog editing and DB ops are admin-only; downloads path-traversal-safe.

## Architecture Constraints
- Keep `main.py` minimal (bootstrap + startup seeds only).
- Routes in `backend/routes/`, business logic in `backend/services/`, AI in
  `backend/ai/`, scanners in `backend/scanner/`. Register routers with `include_router`.
- New feature stores may self-init their tables (see `ai_operations_store`,
  `pentest_tools`) instead of editing the shared `mysql_db` bootstrap — safer for
  the live server.
- Type hints; structured dict returns; validate all input; never hardcode secrets;
  refactor the existing structure instead of rewriting.

## Runtime facts
- Run with `./run.sh` (venv `venv/`, port 80). MySQL env: `MYSQL_*` (defaults
  ssvp/ssvp/ssvp123). Ollama CPU ~180 s/turn — always keep deterministic fallbacks.
- Frontend is served from disk + Jinja (auto-reload); backend changes need a
  server restart, static/template changes just need a browser refresh (bump the
  `?v=` query in the template). No JS build step.
