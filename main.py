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