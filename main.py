from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from backend.routes.auth_routes import router as auth_router
from backend.routes.panel_routes import router as panel_router
from backend.routes.scan_routes import router as scan_router
from backend.routes.settings_routes import router as settings_router
from backend.auth import SESSION_COOKIE_NAME
from backend.services.auth_store import init_auth_store
from backend.services.auth_store import get_user_by_session
from backend.services.settings_store import init_settings_store
from backend.services.offer_store import init_offer_store


app = FastAPI(title="Smart Security Validation Platform")

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

app.router.routes.extend(scan_router.routes)
app.router.routes.extend(auth_router.routes)
app.router.routes.extend(settings_router.routes)
app.router.routes.extend(panel_router.routes)


@app.on_event("startup")
def on_startup():
    init_auth_store()
    init_settings_store()
    init_offer_store()


@app.get("/", response_class=HTMLResponse)
def home_root():
    return RedirectResponse(url="/tr")


@app.get("/tr", response_class=HTMLResponse)
def home_tr(request: Request):
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    current_user = get_user_by_session(session_token) if session_token else None

    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={
            "home_lang": "tr",
            "current_user": current_user,
            "has_home_session": bool(session_token),
        },
    )


@app.get("/en", response_class=HTMLResponse)
def home_en(request: Request):
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    current_user = get_user_by_session(session_token) if session_token else None

    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={
            "home_lang": "en",
            "current_user": current_user,
            "has_home_session": bool(session_token),
        },
    )


@app.get("/app", response_class=HTMLResponse)
def app_page(request: Request):
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    current_user = get_user_by_session(session_token) if session_token else None
    if not current_user:
        return RedirectResponse(url="/tr?login=1")

    return templates.TemplateResponse(
        request=request,
        name="app.html",
        context={"current_user": current_user},
    )


@app.get("/app.html")
def app_page_alias():
    return RedirectResponse(url="/app")


@app.get("/settings", response_class=HTMLResponse)
def settings_page(request: Request):
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    current_user = get_user_by_session(session_token) if session_token else None
    if not current_user:
        return RedirectResponse(url="/tr?login=1")

    return templates.TemplateResponse(
        request=request,
        name="settings.html",
        context={"current_user": current_user}
    )


@app.get("/settings.html")
def settings_page_alias():
    return RedirectResponse(url="/settings")


@app.get("/panel", response_class=HTMLResponse)
def panel_page(request: Request):
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    current_user = get_user_by_session(session_token) if session_token else None
    if not current_user:
        return RedirectResponse(url="/tr?login=1")

    return templates.TemplateResponse(
        request=request,
        name="panel.html",
        context={"current_user": current_user},
    )


@app.get("/panel.html")
def panel_page_alias():
    return RedirectResponse(url="/panel")