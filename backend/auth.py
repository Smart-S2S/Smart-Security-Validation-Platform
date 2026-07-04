from collections.abc import Callable

from fastapi import Cookie, Depends, HTTPException, Request, status

from backend.i18n import request_lang, t
from backend.services.auth_store import get_user_by_session


SESSION_COOKIE_NAME = "ssvp_session"


def get_current_user(
    request: Request,
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
) -> dict:
    lang = request_lang(request)
    if not session_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=t(lang, "auth.required", "Giriş gerekli"))

    user = get_user_by_session(session_token)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=t(lang, "auth.invalidSession", "Geçersiz veya süresi dolmuş oturum"))

    return user


def require_roles(*roles: str, allow_admin: bool = True, allow_must_change_password: bool = False) -> Callable:
    def checker(request: Request, current_user: dict = Depends(get_current_user)) -> dict:
        lang = request_lang(request)
        if current_user.get("must_change_password") and not allow_must_change_password:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=t(lang, "auth.changePasswordRequired", "Devam etmek için önce şifrenizi değiştirin"),
            )

        if allow_admin and current_user.get("is_admin"):
            return current_user

        if not roles:
            return current_user

        user_roles = set(current_user.get("roles") or [])
        if any(role in user_roles for role in roles):
            return current_user

        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=t(lang, "auth.insufficientPermissions", "Yetersiz yetki"))

    return checker
