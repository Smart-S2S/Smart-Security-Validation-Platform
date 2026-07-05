# Smart Security Validation Platform (SSVP)

AI-assisted, **authorized-only** security validation platform (labs / owned systems).
It discovers, validates, attacks (in a controlled way), analyzes, remediates and
retests security issues, driven either by an operator or by a local/cloud LLM.

> Defensive use only. Authorized pentest in owned/lab environments. Never against
> third-party systems without explicit written authorization.

---

## Two independent validation flows

SSVP has **two parallel, fully independent** ways to run tool operations. Both are
built from the **same tool specs** (`backend/services/pentest_tool_specs.py`) but
store their catalogs in **separate tables** and behave differently.

### 1. 3YM — Manual 3-Way Progression (`scan → attack → remediation`)
- **No AI at all.** No prompt is ever sent to the LLM in this flow.
- Data model: `progress_categories → steps → step_items → step_item_parameters`.
- Operator picks direction → category → step → **tool(s)** → reviews parameters →
  approves → runs. A tool may appear in several steps.
- Endpoints: `GET /validation/workflow-steps`, `POST /validation/step-scripts`
  (loads a step's registered scripts + saved params, AI-free), `POST
  /validation/execute-intent` (runs one script item).
- Catalog editors live on the **Panel** page ("İlerleme Kategorileri" + "Adım Listesi").

### 2. YZO — AI Orchestrator (Yapay Zeka Orkestratörü)
- The **local/cloud LLM drives** stage + operation selection, turn by turn.
- Data model (independent): `ai_operations → ai_operation_params`.
- Role-filtered by stage (`scan→test`, `attack→attack`, `remediation→remediation`).
- Endpoints: `POST /validation/ai-orchestrate` (plan next op; also honors an
  operator **redirect** to a specific stage/operation via `preferred_action`),
  `POST /validation/ai-execute-intent` (runs one operation).
- Each approved run opens a **new left tab** and the loop continues there.
- Operations (per tool) are inspectable in **Settings → Pentest Araçları →
  "Operasyon Özellikleri"**.

Both flows record into the shared `validation_actions` history (manual rows carry a
real `step_id`; YZO rows use `step_id NULL` + `step_key "ai:{stage}:{op}"`).

---

## Pentest records & reporting

The **Panel → "Pentest Kayıtları"** page turns `validation_actions` history into
browsable pentest records, grouped **one row per target** (a "pentest" = every
operation run against that target).

- **Access:** visible to admins and any `test`/`attack`/`remediation` role.
  **Admins see every pentest; everyone else sees only their own** (`created_by`),
  enforced on every endpoint.
- **List:** target, stages, operation count, status breakdown, top risk, who ran
  it and when. **Detail** (via the "Detay" button) shows each operation's report
  (AI summary, findings, result) plus the **files it produced** under `scans/`
  (download / delete).
- **Cascade delete:** deleting a pentest record removes its `validation_actions`
  rows (report/log/results live in the row) **and** the scan files they produced.
- **Export:** a detail can be downloaded as **PDF** (xhtml2pdf, Turkish-safe via an
  embedded DejaVuSans `@font-face`) or **Word** (`python-docx`), or opened as a
  print-ready page ("Yazdır").
- Endpoints: `GET /validation/pentests`, `GET /validation/pentests/detail`,
  `POST /validation/pentests/delete`, `POST /validation/pentests/file-delete`,
  `GET /validation/pentests/file-download`, `GET /validation/pentests/report`
  (`format=html|pdf|docx`). Services: `pentest_artifacts.py` (result→file linking,
  path-traversal-safe), `pentest_report.py` (HTML/PDF/Word).

Files produced by AI OSINT scan/exclude lists are managed under **Panel → "Ön
Bellek"** (a view/download/delete cache; uploads happen only from the operation
form).

---

## Tools

- Single source of truth: `backend/services/pentest_tool_specs.py` — **23 tools**,
  ~258 parameters. Each tool declares a rich, injection-safe parameter set (label,
  type, choices, help, default, required) plus how each param maps onto the argv.
- A generic, spec-driven wrapper (`build_argv`) turns a spec into a runnable
  script; there are **no shell strings** — argv is always a list; every value is
  regex-validated. Wrappers report `tool_installed:false` cleanly if the binary is
  absent.
- Tools covered (scan/recon + attack): nmap, masscan, netdiscover, dnsrecon,
  dnsenum, theHarvester, dirb, gobuster, ffuf, wfuzz, whatweb, wafw00f, sslscan,
  smbclient, enum4linux, nbtscan, nikto, hydra, medusa, sqlmap, john, hashcat,
  msfconsole (Metasploit, with named datastore options + a free-form
  `extra_options` map for any `set KEY value`).
- Wrapper files: `data/ai_operations/*.py` (YZO), `data/step_item_scripts/**` (3YM).
- Server-side tool install/update/remove (apt / Rapid7 msfinstall) is managed in
  `backend/services/pentest_tools.py` (Settings → "Pentest Araçları", admin-only).

### Re-seeding after a spec change
Edit `pentest_tool_specs.py`, then propagate to **both** catalogs:
```bash
./venv/bin/python -m scripts.seed_ai_operations     # YZO (upsert, ids stable)
./venv/bin/python -c "from backend.services.manual_catalog_store import refresh_manual_catalog as r; print(r())"   # 3YM in-place (ids stable)
```
- `scripts/seed_manual_catalog.py` = **wipe + rebuild** the 3YM catalog (resets ids).
- `refresh_manual_catalog()` = update wrappers/params **in place** (ids unchanged).
The live server reads DB + on-disk scripts, so re-seeding in a separate process
takes effect without a restart (browser just refreshes for new JS/CSS).

---

## AI provider

- Local **Ollama** (`http://localhost:11434`, default model `freehuntx/qwen3-coder:8b`)
  or **cloud** (OpenAI-compatible / Anthropic). Switchable in Settings → AI.
- `backend/ai/ollama_client.py` routes every AI helper (evaluate / suggest /
  orchestrate) through `_ollama_chat` (`format:json`, `think:false`). CPU Ollama is
  slow (~180 s/turn) — calls run as background tasks and have deterministic fallbacks.

---

## Stack

Ubuntu · Python 3.12 · FastAPI · MySQL · Ollama (local) or cloud LLM · Kali/pentest
CLI tools · xhtml2pdf + python-docx (report export).

## Run

```bash
./run.sh        # activates venv/, serves uvicorn main:app on :80
```
Environment (defaults shown):
`MYSQL_HOST=127.0.0.1 MYSQL_PORT=3306 MYSQL_USER=ssvp MYSQL_PASSWORD=ssvp123 MYSQL_DATABASE=ssvp`

On startup (`main.py`) the schema is created, and the AI + manual catalogs
self-seed **if empty** (never auto-wiped). Default admin: `admin` / `admin`.

## Database (MySQL)

- Auth (users, roles, sessions), app settings, offers.
- 3YM catalog: `progress_categories`, `steps`, `step_items`, `step_item_parameters`.
- YZO catalog: `ai_operations`, `ai_operation_params`.
- History: `validation_actions` (also powers the Panel "Pentest Kayıtları" page,
  grouped by target). Tool state cache: `pentest_tools`.

## Docs

- [`AGENTS.md`](AGENTS.md) — contract + **current implementation state** (read first).
- [`AI_RULES.md`](AI_RULES.md) — AI role, safety boundaries, coding rules.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — layered + data architecture.
- [`ROADMAP.md`](ROADMAP.md).
