# Roadmap

## Done
- FastAPI + MySQL + Ollama (local) / cloud LLM (switchable).
- Nmap + masscan + netdiscover scanners; live activity log; background jobs.
- **23 pentest tools** as spec-driven, injection-safe wrappers
  (`pentest_tool_specs.py`, ~258 params), with server-side install/update/remove.
- **3YM** manual 3-way flow (AI-free, tool-based catalog, per-step tool selection).
- **YZO** AI Orchestrator: independent catalog, role-filtered, per-run tab,
  operation-level redirect.
- Panel catalog editors (steps/items/params + Ace script editor); Settings
  per-tool "Operasyon Özellikleri".
- SSVP_RESULT_JSON evidence + (YZO) AI risk evaluation; `validation_actions` history.
- **Pentest Kayıtları** page: history grouped by target (owner-scoped), detail with
  produced-file download/delete, cascade delete, and PDF / Word / print export.
- **One-command install** (`install.py`) for a fresh server + a dedicated admin
  account with a generated password (default `admin/admin` disabled).
- **Database & Backup** settings tab: no-downtime DB password change (verify +
  rollback) and on-demand mysqldump backups (download/delete).
- Hardened input handling across tool install, operation parameters and scripts
  (no shell, allowlisted install, strict parameter validation).

## Next
- More tools (nuclei, httpx) as new specs in `pentest_tool_specs.py`.
- Remediation planner + retest loop surfaced in the UI.
- Dashboard / multi-target overview.
