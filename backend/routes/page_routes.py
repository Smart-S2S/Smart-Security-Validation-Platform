from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from backend.auth import SESSION_COOKIE_NAME
from backend.services.auth_store import get_user_by_session


router = APIRouter()
templates = Jinja2Templates(directory="templates")

# Logged-in app pages must never be served from browser cache, otherwise UI
# changes (and their versioned CSS/JS URLs) don't reach the user until a hard
# refresh.
_NO_STORE = {"Cache-Control": "no-store, must-revalidate"}


def _current_user_from_request(request: Request) -> tuple[str | None, dict | None]:
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    current_user = get_user_by_session(session_token) if session_token else None
    return session_token, current_user


@router.get("/", response_class=HTMLResponse)
def home_root():
    return RedirectResponse(url="/tr")


@router.get("/tr", response_class=HTMLResponse)
def home_tr(request: Request):
    session_token, current_user = _current_user_from_request(request)
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={
            "home_lang": "tr",
            "current_user": current_user,
            "has_home_session": bool(session_token),
        },
    )


@router.get("/en", response_class=HTMLResponse)
def home_en(request: Request):
    session_token, current_user = _current_user_from_request(request)
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={
            "home_lang": "en",
            "current_user": current_user,
            "has_home_session": bool(session_token),
        },
    )


@router.get("/app", response_class=HTMLResponse)
def app_page(request: Request):
    _, current_user = _current_user_from_request(request)
    if not current_user:
        return RedirectResponse(url="/tr?login=1")

    return templates.TemplateResponse(
        request=request,
        name="app.html",
        context={"current_user": current_user},
        headers=_NO_STORE,
    )


@router.get("/app.html")
def app_page_alias():
    return RedirectResponse(url="/app")


@router.get("/settings", response_class=HTMLResponse)
def settings_page(request: Request):
    _, current_user = _current_user_from_request(request)
    if not current_user:
        return RedirectResponse(url="/tr?login=1")

    return templates.TemplateResponse(
        request=request,
        name="settings.html",
        context={"current_user": current_user},
        headers=_NO_STORE,
    )


@router.get("/settings.html")
def settings_page_alias():
    return RedirectResponse(url="/settings")


@router.get("/panel", response_class=HTMLResponse)
def panel_page(request: Request):
    _, current_user = _current_user_from_request(request)
    if not current_user:
        return RedirectResponse(url="/tr?login=1")

    return templates.TemplateResponse(
        request=request,
        name="panel.html",
        context={"current_user": current_user},
        headers=_NO_STORE,
    )


@router.get("/panel.html")
def panel_page_alias():
    return RedirectResponse(url="/panel")
