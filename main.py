from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from backend.routes.auth_routes import router as auth_router
from backend.routes.panel_routes import router as panel_router
from backend.routes.page_routes import router as page_router
from backend.routes.scan_routes import router as scan_router
from backend.routes.settings_routes import router as settings_router
from backend.services.offer_store import init_offer_store
from backend.routes.validation_routes import router as validation_router
from backend.services.auth_store import init_auth_store
from backend.services.orchestrator_store import init_orchestrator_store
from backend.services.settings_store import init_settings_store
from backend.services.ai_operations_store import (
    deactivate_manual_kali_catalog,
    ensure_seeded as ensure_ai_operations_seeded,
    ensure_stage_seeded,
    seed_ai_native_operations,
)
from backend.services.manual_catalog_store import (
    ensure_manual_catalog_seeded,
    ensure_catalog_additions,
)
from backend.services.wordlist_store import init_wordlist_store, migrate_wordlist_names


app = FastAPI(title="Smart Security Validation Platform")

app.mount("/static", StaticFiles(directory="static"), name="static")
app.include_router(page_router)
app.include_router(scan_router)
app.include_router(auth_router)
app.include_router(settings_router)
app.include_router(panel_router)
app.include_router(validation_router)


@app.on_event("startup")
def on_startup():
    init_auth_store()
    init_settings_store()
    init_offer_store()
    init_orchestrator_store()
    # AI Orchestrator's independent catalog: self-seed on first run, and keep the
    # tool operations out of the manual 3-way flow.
    ensure_ai_operations_seeded()
    deactivate_manual_kali_catalog()
    # Manual 3-way (3YM) catalog: self-seed on first run only (never auto-wipes).
    ensure_manual_catalog_seeded()
    # Backfill remediation operations for existing installs (both flows) without a
    # destructive rebuild: YZO gets stage='remediation' ops, 3YM gets the new
    # remediation category blocks — only if they are missing.
    ensure_stage_seeded("remediation")
    ensure_catalog_additions()
    # AI-native OSINT operation lives only in the YZO catalog (idempotent upsert).
    seed_ai_native_operations()
    # Wordlist (sözlük) catalog: ensure table + upload dir exist, then bring any
    # existing rows onto the prefixed naming scheme (tool./loaded.).
    init_wordlist_store()
    migrate_wordlist_names()
    # Re-apply admin per-tool parameter defaults on top of the freshly seeded
    # catalog (so they survive a re-seed).
    from backend.services.tool_config import reapply_all as reapply_tool_config
    reapply_tool_config()