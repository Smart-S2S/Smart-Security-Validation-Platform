import json
from functools import lru_cache
from pathlib import Path

from fastapi import Request


I18N_DIR = Path(__file__).resolve().parents[1] / "static" / "i18n"
DEFAULT_LANG = "tr"


BACKEND_TRANSLATIONS = {
    "tr": {
        "status.queued": "kuyrukta",
        "status.running": "calisiyor",
        "status.finished": "tamamlandi",
        "scan.job.queued": "Tarama kuyruğa alındı.",
        "scan.job.tool": "Seçilen araç: {tool}",
        "scan.job.paramCount": "Seçilen parametre sayısı: {count}",
        "scan.job.portCount": "Seçilen port sayısı: {count}",
        "scan.job.nmap.start": "Nmap ile host ve servis taraması başlatılıyor...",
        "scan.job.masscan.demo": "Masscan seçildi. Bu sürümde güvenli demo modu ile sonuç üretiliyor...",
        "scan.job.masscan.note": "Masscan entegrasyonu demo modunda çalıştı.",
        "scan.job.netdiscover.demo": "netdiscover seçildi. Bu sürümde güvenli demo modu ile sonuç üretiliyor...",
        "scan.job.netdiscover.note": "netdiscover entegrasyonu demo modunda çalıştı.",
        "scan.job.unsupportedTool": "Desteklenmeyen tarama aracı.",
        "scan.job.analyzing": "Bulgular yorumlanıyor...",
        "scan.job.analysisDone": "Analiz tamamlandı.",
        "scan.job.aiDisabled": "Bu araç için AI yorum adımı henüz aktif değil.",
        "scan.job.processing": "Tarama sonucu işleniyor...",
        "scan.job.finished": "Tarama tamamlandı.",
        "nmap.error.emptyTarget": "Target bos olamaz.",
        "nmap.fake.lab": "Lab modu: sahte Nmap sonucu uretiliyor...",
        "nmap.params": "Nmap parametreleri: {params}",
        "nmap.ports.selected": "Nmap port secimi: {ports}",
        "nmap.ports.found": "{count} port sonucu bulundu.",
        "nmap.ports.all": "Nmap port listesi: all (1-65535)",
        "nmap.ports.list": "Nmap port listesi: {ports}",
        "nmap.params.list": "Nmap parametre listesi: {params}",
        "nmap.running": "Nmap taramasi calistiriliyor...",
        "nmap.error.generic": "Nmap hata verdi.",
        "nmap.parsing": "Nmap XML ciktisi parse ediliyor...",
        "nmap.error.timeout": "Tarama zaman asimina ugradi.",
        "nmap.error.notInstalled": "Nmap kurulu degil veya PATH icinde bulunamadi.",
        "nmap.error.exception": "Hata olustu: {message}",
        "masscan.error.notInstalled": "Masscan kurulu degil veya PATH icinde bulunamadi.",
        "masscan.error.permission": "Masscan icin root yetkisi (veya CAP_NET_RAW/CAP_NET_ADMIN) gerekir.",
        "netdiscover.error.notInstalled": "netdiscover kurulu degil veya PATH icinde bulunamadi.",
        "netdiscover.error.permission": "netdiscover icin root yetkisi (veya CAP_NET_RAW/CAP_NET_ADMIN) gerekir.",
        "netdiscover.warning.passiveNoTraffic": "Pasif modda zaman asimi: ARP trafigi gozlenmedigi icin host bulunamadi.",
        "ai.scanFailed": "Tarama hatalı tamamlandığı için AI analizi yapılamadı.",
        "ai.noResponse": "Yorumlama yapılamadı.",
        "scan.route.invalidTool": "Geçersiz tarama aracı seçildi.",
        "scan.route.invalidPorts": "Gecersiz port degeri",
        "scan.route.paramConflict": "Parametre cakismasi",
        "scan.route.sameGroupConflict": "Ayni gruptan birden fazla parametre secildi: {params}",
        "scan.route.hardConflict": "Birlikte kullanilamaz: {left} + {right}",
        "scan.route.jobNotFound": "Job bulunamadı",
        "scan.route.fileNotFound": "Dosya bulunamadı",
        "auth.required": "Giriş gerekli",
        "auth.invalidSession": "Geçersiz veya süresi dolmuş oturum",
        "auth.changePasswordRequired": "Devam etmek için önce şifrenizi değiştirin",
        "auth.insufficientPermissions": "Yetersiz yetki",
        "auth.invalidRoles": "Geçersiz roller: {roles}",
        "auth.cannotManageAdmin": "Admin kullanıcı üzerinde işlem yapamazsınız",
        "auth.invalidCredentials": "Kullanıcı adı veya şifre hatalı",
        "auth.currentPasswordInvalid": "Mevcut şifre hatalı",
        "auth.usernameExists": "Bu kullanıcı adı zaten var",
        "auth.onlyAdminCanCreateAdmin": "Sadece admin, admin oluşturabilir",
        "auth.onlyAdminCanAssignAdmin": "Sadece admin, admin atayabilir",
        "auth.cannotDemoteAdmin": "Admin hesabını düşüremezsiniz",
        "auth.cannotEditAdminRoles": "Admin rollerini düzenleyemezsiniz",
        "auth.passwordChangeBothRequired": "Şifre değişikliği için iki alan da gerekli",
        "auth.passwordConfirmMismatch": "Şifre doğrulama başarısız",
        "auth.lastAdminImmutable": "Son admin hesabı değiştirilemez",
        "auth.cannotDeleteSelf": "Kendi hesabınızı silemezsiniz",
        "auth.lastAdminCannotDelete": "Son admin hesabı silinemez",
        "user.notFound": "Kullanıcı bulunamadı",
        "settings.onlyAdminCanUpdate": "Sadece admin bu ayarı değiştirebilir",
        "settings.onlyAdminCanViewModels": "Sadece admin bu listeyi görebilir",
        "validation.invalidStage": "Gecersiz validation asamasi",
        "validation.approvalRequired": "Bu action icin kullanici onayi gerekli",
    },
    "en": {
        "status.queued": "queued",
        "status.running": "running",
        "status.finished": "finished",
        "scan.job.queued": "Scan job queued.",
        "scan.job.tool": "Selected tool: {tool}",
        "scan.job.paramCount": "Selected parameter count: {count}",
        "scan.job.portCount": "Selected port count: {count}",
        "scan.job.nmap.start": "Starting host and service scan with Nmap...",
        "scan.job.masscan.demo": "Masscan selected. This version produces results in safe demo mode...",
        "scan.job.masscan.note": "Masscan integration ran in demo mode.",
        "scan.job.netdiscover.demo": "netdiscover selected. This version produces results in safe demo mode...",
        "scan.job.netdiscover.note": "netdiscover integration ran in demo mode.",
        "scan.job.unsupportedTool": "Unsupported scan tool.",
        "scan.job.analyzing": "Interpreting findings...",
        "scan.job.analysisDone": "Analysis completed.",
        "scan.job.aiDisabled": "AI interpretation is not yet active for this tool.",
        "scan.job.processing": "Processing scan result...",
        "scan.job.finished": "Scan completed.",
        "nmap.error.emptyTarget": "Target cannot be empty.",
        "nmap.fake.lab": "Lab mode: generating a fake Nmap result...",
        "nmap.params": "Nmap parameters: {params}",
        "nmap.ports.selected": "Nmap port selection: {ports}",
        "nmap.ports.found": "{count} port results found.",
        "nmap.ports.all": "Nmap port list: all (1-65535)",
        "nmap.ports.list": "Nmap port list: {ports}",
        "nmap.params.list": "Nmap parameter list: {params}",
        "nmap.running": "Running Nmap scan...",
        "nmap.error.generic": "Nmap returned an error.",
        "nmap.parsing": "Parsing Nmap XML output...",
        "nmap.error.timeout": "The scan timed out.",
        "nmap.error.notInstalled": "Nmap is not installed or could not be found in PATH.",
        "nmap.error.exception": "An error occurred: {message}",
        "masscan.error.notInstalled": "Masscan is not installed or could not be found in PATH.",
        "masscan.error.permission": "Masscan requires root privileges (or CAP_NET_RAW/CAP_NET_ADMIN).",
        "netdiscover.error.notInstalled": "netdiscover is not installed or could not be found in PATH.",
        "netdiscover.error.permission": "netdiscover requires root privileges (or CAP_NET_RAW/CAP_NET_ADMIN).",
        "netdiscover.warning.passiveNoTraffic": "Passive mode timed out: no hosts found because no ARP traffic was observed.",
        "ai.scanFailed": "AI analysis could not run because the scan finished with errors.",
        "ai.noResponse": "Unable to interpret.",
        "scan.route.invalidTool": "Invalid scan tool selected.",
        "scan.route.invalidPorts": "Invalid port value",
        "scan.route.paramConflict": "Parameter conflict",
        "scan.route.sameGroupConflict": "More than one parameter was selected from the same group: {params}",
        "scan.route.hardConflict": "Cannot be used together: {left} + {right}",
        "scan.route.jobNotFound": "Job not found",
        "scan.route.fileNotFound": "File not found",
        "auth.required": "Login required",
        "auth.invalidSession": "Invalid or expired session",
        "auth.changePasswordRequired": "Please change your password before continuing",
        "auth.insufficientPermissions": "Insufficient permissions",
        "auth.invalidRoles": "Invalid roles: {roles}",
        "auth.cannotManageAdmin": "You cannot perform actions on admin users",
        "auth.invalidCredentials": "Invalid username or password",
        "auth.currentPasswordInvalid": "Current password is incorrect",
        "auth.usernameExists": "This username already exists",
        "auth.onlyAdminCanCreateAdmin": "Only admin can create admin users",
        "auth.onlyAdminCanAssignAdmin": "Only admin can assign admin",
        "auth.cannotDemoteAdmin": "You cannot demote an admin account",
        "auth.cannotEditAdminRoles": "You cannot edit admin roles",
        "auth.passwordChangeBothRequired": "Both password fields are required for password change",
        "auth.passwordConfirmMismatch": "Password confirmation mismatch",
        "auth.lastAdminImmutable": "The last admin account cannot be modified",
        "auth.cannotDeleteSelf": "You cannot delete your own account",
        "auth.lastAdminCannotDelete": "The last admin account cannot be deleted",
        "user.notFound": "User not found",
        "settings.onlyAdminCanUpdate": "Only admin can change this setting",
        "settings.onlyAdminCanViewModels": "Only admin can view this list",
        "validation.invalidStage": "Invalid validation stage",
        "validation.approvalRequired": "User approval is required for this action",
    },
}


def normalize_lang(lang_code: str | None) -> str:
    value = (lang_code or DEFAULT_LANG).strip().lower()
    if value not in {"tr", "en"}:
        return DEFAULT_LANG
    return value


@lru_cache(maxsize=8)
def load_dictionary(lang_code: str) -> dict:
    normalized = normalize_lang(lang_code)
    path = I18N_DIR / f"{normalized}.json"
    fallback_path = I18N_DIR / f"{DEFAULT_LANG}.json"

    try:
        with path.open("r", encoding="utf-8") as file_handle:
            return json.load(file_handle)
    except Exception:
        if normalized != DEFAULT_LANG:
            with fallback_path.open("r", encoding="utf-8") as file_handle:
                return json.load(file_handle)
        return {}


def t(lang_code: str | None, key: str, fallback: str = "") -> str:
    normalized = normalize_lang(lang_code)
    backend_dictionary = BACKEND_TRANSLATIONS.get(normalized, {})
    if key in backend_dictionary:
        return backend_dictionary[key]

    dictionary = load_dictionary(normalized)
    return dictionary.get(key) or fallback or key


def request_lang(request: Request | None) -> str:
    if request is None:
        return DEFAULT_LANG

    header = (request.headers.get("accept-language") or "").strip().lower()
    if header.startswith("en"):
        return "en"
    if header.startswith("tr"):
        return "tr"
    return DEFAULT_LANG