from pydantic import BaseModel, Field

from fastapi import APIRouter, Cookie, Depends, Form, HTTPException, Request, Response, status

from backend.auth import SESSION_COOKIE_NAME, get_current_user, require_roles
from backend.i18n import request_lang, t
from backend.services.auth_store import (
    ROLE_USER_MANAGEMENT,
    VALID_ROLES,
    admin_count,
    authenticate,
    create_session,
    create_user,
    delete_session,
    delete_user,
    get_user_by_id,
    get_user_by_username,
    list_users,
    set_user_password,
    update_user,
    verify_password,
)


router = APIRouter()


class UserCreateRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(default="", max_length=120)
    job_title: str = Field(default="", max_length=120)
    phone: str = Field(default="", max_length=40)
    is_admin: bool = False
    roles: list[str] = Field(default_factory=list)


class UserUpdateRequest(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=64)
    full_name: str | None = Field(default=None, max_length=120)
    job_title: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=40)
    is_admin: bool | None = None
    is_active: bool | None = None
    roles: list[str] | None = None
    new_password: str | None = Field(default=None, min_length=8, max_length=128)
    new_password_confirm: str | None = Field(default=None, min_length=8, max_length=128)


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class PasswordResetRequest(BaseModel):
    new_password: str = Field(min_length=8, max_length=128)


def _public_user(user: dict) -> dict:
    return {
        "id": user["id"],
        "username": user["username"],
        "full_name": user.get("full_name", ""),
        "job_title": user.get("job_title", ""),
        "phone": user.get("phone", ""),
        "ui_theme": user.get("ui_theme", "dark"),
        "ui_language": user.get("ui_language", "tr"),
        "is_admin": bool(user.get("is_admin")),
        "is_active": bool(user.get("is_active", True)),
        "must_change_password": bool(user.get("must_change_password")),
        "roles": list(user.get("roles") or []),
        "created_at": user.get("created_at"),
        "updated_at": user.get("updated_at"),
    }


def _ensure_roles_are_valid(roles: list[str] | None, lang: str) -> list[str]:
    if roles is None:
        return []
    invalid = [role for role in roles if role not in VALID_ROLES]
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=t(lang, "auth.invalidRoles", "Geçersiz roller: {roles}").replace("{roles}", ", ".join(invalid)),
        )
    return roles


def _ensure_can_manage_target(actor: dict, target: dict, lang: str) -> None:
    if actor.get("is_admin"):
        return

    if target.get("is_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=t(lang, "auth.cannotManageAdmin", "Admin kullanıcı üzerinde işlem yapamazsınız"),
        )


@router.post("/auth/login")
def login(request: Request, response: Response, username: str = Form(...), password: str = Form(...)):
    lang = request_lang(request)
    user = authenticate(username.strip(), password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=t(lang, "auth.invalidCredentials", "Kullanıcı adı veya şifre hatalı"))

    token = create_session(int(user["id"]))
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=12 * 3600,
    )

    return {
        "user": _public_user(user),
        "must_change_password": bool(user.get("must_change_password")),
    }


@router.post("/auth/logout")
def logout(
    response: Response,
    current_user: dict = Depends(get_current_user),
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
):
    del current_user
    if session_token:
        delete_session(session_token)
    response.delete_cookie(SESSION_COOKIE_NAME)
    return {"ok": True}


@router.get("/auth/me")
def me(current_user: dict = Depends(get_current_user)):
    return _public_user(current_user)


@router.post("/auth/change-password")
def change_password(
    request: Request,
    payload: PasswordChangeRequest,
    current_user: dict = Depends(require_roles(allow_must_change_password=True)),
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
):
    lang = request_lang(request)
    db_user = get_user_by_username(current_user["username"])
    if not db_user or not verify_password(payload.current_password, db_user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=t(lang, "auth.currentPasswordInvalid", "Mevcut şifre hatalı"))

    user_id = int(current_user["id"])
    updated = set_user_password(
        user_id,
        payload.new_password,
        must_change_password=False,
        keep_session_token=session_token,
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=t(lang, "user.notFound", "Kullanıcı bulunamadı"))

    return {"ok": True, "user": _public_user(updated)}


@router.get("/roles")
def roles(current_user: dict = Depends(get_current_user)):
    del current_user
    return {"roles": sorted(VALID_ROLES)}


@router.get("/users")
def users_list(current_user: dict = Depends(require_roles(ROLE_USER_MANAGEMENT))):
    users = list_users()
    if current_user.get("is_admin"):
        return {"items": [_public_user(item) for item in users], "admin_count": admin_count()}

    # User-management role holders can list everyone, but admin users remain read-only for them.
    return {
        "items": [_public_user(item) for item in users],
        "admin_count": admin_count(),
        "admin_locked": True,
    }


@router.post("/users", status_code=201)
def users_create(
    request: Request,
    payload: UserCreateRequest,
    current_user: dict = Depends(require_roles(ROLE_USER_MANAGEMENT)),
):
    lang = request_lang(request)
    roles = _ensure_roles_are_valid(payload.roles, lang)

    if payload.is_admin and not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=t(lang, "auth.onlyAdminCanCreateAdmin", "Sadece admin, admin oluşturabilir"))

    try:
        user = create_user(
            username=payload.username.strip(),
            password=payload.password,
            full_name=payload.full_name,
            job_title=payload.job_title,
            phone=payload.phone,
            is_admin=payload.is_admin,
            roles=roles,
            must_change_password=True,
        )
    except ValueError as exc:
        if str(exc) == "USERNAME_ALREADY_EXISTS":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=t(lang, "auth.usernameExists", "Bu kullanıcı adı zaten var")) from exc
        raise

    return {"item": _public_user(user)}


@router.patch("/users/{user_id}")
def users_update(
    request: Request,
    user_id: int,
    payload: UserUpdateRequest,
    current_user: dict = Depends(require_roles(ROLE_USER_MANAGEMENT)),
):
    lang = request_lang(request)
    target = get_user_by_id(user_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=t(lang, "user.notFound", "Kullanıcı bulunamadı"))

    _ensure_can_manage_target(current_user, target, lang)

    roles = None
    if payload.roles is not None:
        roles = _ensure_roles_are_valid(payload.roles, lang)

    if payload.is_admin is True and not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=t(lang, "auth.onlyAdminCanAssignAdmin", "Sadece admin, admin atayabilir"))

    if payload.is_admin is False and target.get("is_admin") and not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=t(lang, "auth.cannotDemoteAdmin", "Admin hesabını düşüremezsiniz"))

    if not current_user.get("is_admin") and roles is not None and target.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=t(lang, "auth.cannotEditAdminRoles", "Admin rollerini düzenleyemezsiniz"))

    if payload.new_password is not None or payload.new_password_confirm is not None:
        if not payload.new_password or not payload.new_password_confirm:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=t(lang, "auth.passwordChangeBothRequired", "Şifre değişikliği için iki alan da gerekli"))
        if payload.new_password != payload.new_password_confirm:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=t(lang, "auth.passwordConfirmMismatch", "Şifre doğrulama başarısız"))

    try:
        updated = update_user(
            user_id=user_id,
            username=payload.username.strip() if payload.username is not None else None,
            full_name=payload.full_name,
            job_title=payload.job_title,
            phone=payload.phone,
            is_admin=payload.is_admin,
            is_active=payload.is_active,
            roles=roles,
        )
    except ValueError as exc:
        if str(exc) == "USERNAME_ALREADY_EXISTS":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=t(lang, "auth.usernameExists", "Bu kullanıcı adı zaten var")) from exc
        if str(exc) == "LAST_ADMIN":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=t(lang, "auth.lastAdminImmutable", "Son admin hesabı değiştirilemez")) from exc
        raise

    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=t(lang, "user.notFound", "Kullanıcı bulunamadı"))

    if payload.new_password is not None:
        updated = set_user_password(user_id, payload.new_password, must_change_password=True)
        if not updated:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=t(lang, "user.notFound", "Kullanıcı bulunamadı"))

    return {"item": _public_user(updated)}


@router.post("/users/{user_id}/reset-password")
def users_reset_password(
    request: Request,
    user_id: int,
    payload: PasswordResetRequest,
    current_user: dict = Depends(require_roles(ROLE_USER_MANAGEMENT)),
):
    lang = request_lang(request)
    target = get_user_by_id(user_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=t(lang, "user.notFound", "Kullanıcı bulunamadı"))

    _ensure_can_manage_target(current_user, target, lang)

    updated = set_user_password(user_id, payload.new_password, must_change_password=True)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=t(lang, "user.notFound", "Kullanıcı bulunamadı"))

    return {"ok": True, "item": _public_user(updated)}


@router.delete("/users/{user_id}")
def users_delete(
    request: Request,
    user_id: int,
    current_user: dict = Depends(require_roles(ROLE_USER_MANAGEMENT)),
):
    lang = request_lang(request)
    target = get_user_by_id(user_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=t(lang, "user.notFound", "Kullanıcı bulunamadı"))

    _ensure_can_manage_target(current_user, target, lang)

    if int(target["id"]) == int(current_user["id"]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=t(lang, "auth.cannotDeleteSelf", "Kendi hesabınızı silemezsiniz"))

    try:
        deleted = delete_user(user_id)
    except ValueError as exc:
        if str(exc) == "LAST_ADMIN":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=t(lang, "auth.lastAdminCannotDelete", "Son admin hesabı silinemez")) from exc
        raise

    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=t(lang, "user.notFound", "Kullanıcı bulunamadı"))

    return {"ok": True}
