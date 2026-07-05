"""AI-native OSINT recon over a target website.

Fetches the target site and same-domain subpages (including paths discovered by
prior content-discovery runs — dirb/ffuf/gobuster/wfuzz — on the same target, and
any operator-supplied paths), then asks the configured LLM to extract intelligence
useful for an AUTHORIZED penetration / intelligence engagement: names, usernames,
e-mail addresses, phone numbers, physical/work addresses, exposed
secrets/credentials, social handles, employees and technologies.

AI-only by design (there is no CLI tool behind it). Authorized targets only.
"""

from __future__ import annotations

import re
import ssl
import time
import urllib.parse
import urllib.request
from html import unescape
from pathlib import Path

from backend.ai.ollama_client import _ollama_chat
from backend.services.orchestrator_store import list_validation_actions


# Scanned-URL lists are written here as XML and served by /download-scan-file.
_SCAN_DIR = Path("scans")
# Uploaded scan/exclude list files (XML/TXT) — a managed cache dir.
_CACHE_DIR = Path(__file__).resolve().parents[2] / "data" / "osint_cache"
_LIST_EXTS = {".xml", ".txt"}
_SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")
# Absolute upper bound on pages per run (protects against a huge scan/target list).
_HARD_CAP = 2000


def _ensure_cache_dir() -> Path:
    _CACHE_DIR.mkdir(parents=True, exist_ok=True)
    return _CACHE_DIR


def _human_size(num_bytes: int) -> str:
    size = float(max(int(num_bytes or 0), 0))
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024 or unit == "GB":
            return f"{int(size)} {unit}" if unit == "B" else f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} GB"


def save_uploaded_list(original_name: str, data: bytes) -> dict:
    """Save an uploaded scan/exclude list (XML/TXT only) into the cache dir with a
    collision-free name. Returns {name, size, size_h}."""
    _ensure_cache_dir()
    cleaned = _SAFE_NAME.sub("_", Path(original_name or "").name.strip()) or "list.xml"
    stem, ext = (cleaned.rsplit(".", 1) + [""])[:2]
    ext = ("." + ext.lower()) if ext else ""
    if ext not in _LIST_EXTS:
        raise ValueError("Sadece .xml veya .txt dosyası yükleyebilirsiniz.")
    if not data:
        raise ValueError("Yüklenen dosya boş.")
    name = f"{stem}{ext}"
    path = _CACHE_DIR / name
    counter = 1
    while path.exists():
        name = f"{stem}_{counter}{ext}"
        path = _CACHE_DIR / name
        counter += 1
    path.write_bytes(data)
    size = path.stat().st_size
    return {"name": name, "size": size, "size_h": _human_size(size)}


def list_cache_files() -> list[dict]:
    _ensure_cache_dir()
    items = []
    for child in sorted(_CACHE_DIR.iterdir(), key=lambda p: p.name.lower()):
        if child.is_file() and child.suffix.lower() in _LIST_EXTS:
            st = child.stat()
            items.append({"name": child.name, "size": st.st_size, "size_h": _human_size(st.st_size), "modified": int(st.st_mtime)})
    return items


def cache_file_path(name: str) -> Path | None:
    """Return the safe absolute path for a cache file, or None if invalid/missing."""
    safe = Path(str(name or "")).name
    if not safe:
        return None
    path = (_CACHE_DIR / safe).resolve()
    try:
        if path.parent != _CACHE_DIR.resolve() or not path.is_file() or path.suffix.lower() not in _LIST_EXTS:
            return None
    except OSError:
        return None
    return path


def delete_cache_files(names: list[str]) -> int:
    deleted = 0
    for name in names or []:
        path = cache_file_path(name)
        if path:
            try:
                path.unlink()
                deleted += 1
            except OSError:
                pass
    return deleted


def _resolve_list_input(value) -> str:
    """A scan/exclude list param is either an uploaded cache filename or raw text.
    Resolve a bare cache filename to its content; otherwise return the value as-is."""
    text = str(value or "").strip()
    if not text:
        return ""
    # A bare cache filename has no slash / newline / angle bracket; raw XML or a
    # path list always does. Resolve a filename to its file content.
    if "\n" not in text and "<" not in text and "/" not in text:
        path = cache_file_path(text)
        if path:
            try:
                return path.read_text(errors="replace")
            except OSError:
                return ""
    return text


_UA = "Mozilla/5.0 (SSVP-OSINT; authorized-lab recon)"
_SCRIPT_STYLE = re.compile(r"<(script|style|noscript)[^>]*>.*?</\1>", re.I | re.S)
_TAG = re.compile(r"<[^>]+>")
_HREF = re.compile(r"""href\s*=\s*["']([^"'#\s]+)["']""", re.I)
_WS = re.compile(r"[ \t\r\f\v]+")
_BLANKS = re.compile(r"\n\s*\n+")

_EMAIL = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
_PHONE = re.compile(r"(?<!\d)(?:\+?\d[\d\s().\-]{7,17}\d)(?!\d)")
_URL = re.compile(r"https?://[^\s\"'<>()]+")
_PATH = re.compile(r"(?:^|[\s'\">])(/[A-Za-z0-9_][A-Za-z0-9_./?=%&\-]{0,120})")

_DISCOVERY_ACTIONS = {"dirb_content_discovery", "ffuf_fuzz", "gobuster_dir_scan", "wfuzz_fuzz"}

# Asset extensions worth skipping while crawling — they carry no OSINT text and
# would otherwise burn the page budget.
_ASSET_EXT = (
    ".css", ".js", ".mjs", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico",
    ".webp", ".woff", ".woff2", ".ttf", ".eot", ".pdf", ".zip", ".gz", ".mp4",
    ".webm", ".mp3", ".map", ".avif",
)


def _is_asset(url: str) -> bool:
    path = urllib.parse.urlparse(url).path.lower()
    return path.endswith(_ASSET_EXT)

_RESULT_KEYS = (
    "summary", "emails", "phones", "names", "usernames", "addresses",
    "social_profiles", "credentials", "employees", "technologies", "other",
)


def _as_int(value, default: int, lo: int, hi: int) -> int:
    try:
        n = int(str(value).strip())
    except Exception:
        return default
    return max(lo, min(n, hi))


def _truthy(value, default: bool) -> bool:
    if value is None or value == "":
        return default
    return str(value).strip().lower() in {"1", "true", "on", "yes", "evet", "acik", "açık"}


def _split_paths(value) -> list[str]:
    if not value:
        return []
    if isinstance(value, list):
        raw = value
    else:
        raw = re.split(r"[\s,;]+", str(value))
    return [p.strip() for p in raw if p and p.strip()]


def target_to_url(target: str) -> str:
    token = (target or "").strip()
    if not token:
        return ""
    if not token.startswith(("http://", "https://")):
        token = "http://" + token
    return token


def _same_host(base: str, url: str) -> bool:
    try:
        b = urllib.parse.urlparse(base)
        u = urllib.parse.urlparse(url)
        return u.netloc == "" or u.netloc == b.netloc
    except Exception:
        return False


def _fetch(url: str, timeout: int = 15) -> str:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(url, headers={"User-Agent": _UA, "Accept": "text/html,application/xhtml+xml,*/*"})
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
        ctype = str(resp.headers.get("Content-Type") or "").lower()
        if not any(tok in ctype for tok in ("html", "text", "json", "xml")):
            return ""
        raw = resp.read(1_500_000)  # cap 1.5 MB per page
    charset = "utf-8"
    match = re.search(r"charset=([\w\-]+)", ctype)
    if match:
        charset = match.group(1)
    try:
        return raw.decode(charset, errors="replace")
    except Exception:
        return raw.decode("utf-8", errors="replace")


def _visible_text(html: str) -> str:
    text = _SCRIPT_STYLE.sub(" ", html)
    text = _TAG.sub(" ", text)
    text = unescape(text)
    text = _WS.sub(" ", text)
    text = _BLANKS.sub("\n", text)
    return text.strip()


def _links(base: str, html: str) -> list[str]:
    out = []
    for href in _HREF.findall(html):
        try:
            full = urllib.parse.urljoin(base, href)
        except Exception:
            continue
        full = full.split("#")[0]
        if full.startswith(("http://", "https://")) and _same_host(base, full) and not _is_asset(full):
            out.append(full)
    return out


def _prior_discovered_urls(base: str, target: str) -> list[str]:
    """Same-host URLs found by prior dirb/ffuf/gobuster/wfuzz runs on this target."""
    found: set[str] = set()
    try:
        actions = list_validation_actions(target)
    except Exception:
        return []
    for action in actions:
        if str(action.get("action_key") or "").strip().lower() not in _DISCOVERY_ACTIONS:
            continue
        evidence = action.get("evidence") if isinstance(action.get("evidence"), dict) else {}
        result = evidence.get("result") if isinstance(evidence.get("result"), dict) else {}
        tail = result.get("output_tail")
        if not isinstance(tail, list):
            continue
        for line in tail:
            text = str(line)
            for url in _URL.findall(text):
                url = url.split("#")[0]
                if _same_host(base, url):
                    found.add(url)
            for path in _PATH.findall(text):
                found.add(urllib.parse.urljoin(base, path))
    return list(found)


def _build_prompt(base: str, corpus: str, focus: str) -> str:
    focus_line = f"\nÖzellikle şuna odaklan: {focus}\n" if focus else ""
    return (
        "Sen yetkili bir sızma testi ekibinde çalışan bir OSINT/istihbarat analistisin. "
        "Aşağıda bir hedef web sitesinden (ve alt sayfalarından) toplanmış metin var. "
        "Bu içerikten, yetkili bir sızma testi/istihbarat çalışması için işe yarayacak "
        "TÜM verileri çıkar. Sadece metinde gerçekten geçen bilgileri kullan; uydurma.\n"
        f"Hedef: {base}{focus_line}\n"
        "Çıkarılacaklar: kişi isimleri, kullanıcı adları, e-posta adresleri, telefon "
        "numaraları, ev/iş adresleri, çalışan ve unvan bilgileri, sosyal medya hesapları, "
        "sızmış/görünür parola-anahtar-token gibi kimlik bilgileri, kullanılan teknolojiler, "
        "ve saldırı yüzeyi için değerli diğer her şey.\n\n"
        "SADECE şu JSON şemasıyla yanıt ver (başka metin yazma):\n"
        "{\n"
        '  "summary": "Türkçe kısa özet (2-4 cümle) — ne bulundu, ne işe yarar",\n'
        '  "risk_level": "low|medium|high",\n'
        '  "emails": ["..."],\n'
        '  "phones": ["..."],\n'
        '  "names": ["..."],\n'
        '  "usernames": ["..."],\n'
        '  "addresses": ["..."],\n'
        '  "social_profiles": ["..."],\n'
        '  "credentials": ["metinde görünen parola/anahtar/token ve nerede"],\n'
        '  "employees": [{"name": "...", "title": "...", "contact": "..."}],\n'
        '  "technologies": ["..."],\n'
        '  "other": ["diğer işe yarar bulgular"]\n'
        "}\n\n"
        "=== TOPLANAN METİN ===\n"
        f"{corpus}\n"
        "=== SON ===\n"
    )


def _parse_findings(raw: str | None) -> dict:
    from backend.ai.ollama_client import _extract_first_json_block  # reuse the robust extractor
    import json

    if not raw:
        return {}
    block = _extract_first_json_block(raw) or raw
    try:
        data = json.loads(block)
    except Exception:
        return {}
    if not isinstance(data, dict):
        return {}
    out: dict = {}
    if data.get("summary"):
        out["summary"] = str(data["summary"]).strip()
    if data.get("risk_level"):
        out["risk_level"] = str(data["risk_level"]).strip().lower()
    for key in ("emails", "phones", "names", "usernames", "addresses", "social_profiles", "credentials", "technologies", "other"):
        value = data.get(key)
        if isinstance(value, list):
            out[key] = [str(v).strip() for v in value if str(v).strip()]
    emp = data.get("employees")
    if isinstance(emp, list):
        cleaned = []
        for item in emp:
            if isinstance(item, dict):
                cleaned.append({k: str(v) for k, v in item.items() if v not in (None, "")})
            elif str(item).strip():
                cleaned.append({"name": str(item).strip()})
        if cleaned:
            out["employees"] = cleaned
    return out


def _merge_unique(*lists) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for lst in lists:
        for item in lst or []:
            token = str(item).strip()
            key = token.lower()
            if token and key not in seen:
                seen.add(key)
                out.append(token)
    return out


def _norm_url(url: str) -> str:
    return str(url or "").split("#")[0].rstrip("/").lower()


def _extract_urls_and_paths(raw) -> list[str]:
    """Pull full URLs and bare paths out of an XML/sitemap/plain-list blob, in
    order, de-duplicated. Schema-agnostic (works for <url>/<loc>/plain lines)."""
    text = raw if isinstance(raw, str) else ("" if raw is None else str(raw))
    if not text.strip():
        return []
    out: list[str] = []
    seen: set[str] = set()
    for url in _URL.findall(text):
        url = url.split("#")[0]
        if url.lower() not in seen:
            seen.add(url.lower())
            out.append(url)
    for path in _PATH.findall(text):
        if path.lower() not in seen:
            seen.add(path.lower())
            out.append(path)
    return out


def _parse_exclude(raw) -> tuple[set, set]:
    """Return (excluded full-URL set, excluded path set) from an XML/list blob."""
    ex_urls: set[str] = set()
    ex_paths: set[str] = set()
    for token in _extract_urls_and_paths(raw):
        if token.startswith(("http://", "https://")):
            ex_urls.add(_norm_url(token))
        else:
            ex_paths.add(token.rstrip("/").lower())
    return ex_urls, ex_paths


def _is_excluded(url: str, ex_urls: set, ex_paths: set) -> bool:
    if not ex_urls and not ex_paths:
        return False
    if _norm_url(url) in ex_urls:
        return True
    try:
        path = urllib.parse.urlparse(url).path.rstrip("/").lower()
    except Exception:
        return False
    return bool(path) and path in ex_paths


def _xml_escape(value: str) -> str:
    return (str(value or "").replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;").replace("'", "&apos;"))


def _save_scanned_urls_xml(base: str, urls: list[str]) -> str:
    """Write the scanned-URL list to scans/osint_urls_<ts>.xml, return the basename
    (served via /download-scan-file). Keeps the big list off the result page."""
    _SCAN_DIR.mkdir(exist_ok=True)
    name = f"osint_urls_{int(time.time())}.xml"
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<scanned_pages target="{_xml_escape(base)}" count="{len(urls)}">',
    ]
    lines += [f"  <page>{_xml_escape(u)}</page>" for u in urls]
    lines.append("</scanned_pages>")
    (_SCAN_DIR / name).write_text("\n".join(lines), encoding="utf-8")
    return name


def _fetch_page(url: str, log) -> dict | None:
    try:
        html = _fetch(url)
    except Exception as exc:
        log(f"getirilemedi: {url} ({exc})")
        return None
    if not html:
        return None
    text = _visible_text(html)
    if not text:
        return {"url": url, "text": "", "html": html}
    log(f"tarandı: {url} ({len(text)} karakter)")
    return {"url": url, "text": text, "html": html}


def run_osint(target: str, parameters: dict, log=lambda _m: None) -> dict:
    """Crawl (or scan an explicit list) + AI-extract. Returns an SSVP result dict."""
    parameters = parameters or {}
    max_pages = _as_int(parameters.get("max_pages"), 1000, 1, _HARD_CAP)
    focus = str(parameters.get("focus") or "").strip()
    # Scan/exclude lists may be an uploaded cache filename or raw XML/text.
    ex_urls, ex_paths = _parse_exclude(_resolve_list_input(parameters.get("exclude_list")))

    # Explicit target list: scan exactly these URLs (minus excluded), ignoring the
    # crawl parameters. No target is required in this mode.
    scan_items = _extract_urls_and_paths(_resolve_list_input(parameters.get("scan_list")))
    pages: list[dict] = []

    if scan_items:
        full = [u for u in scan_items if u.startswith(("http://", "https://"))]
        base = full[0] if full else target_to_url(parameters.get("target_url") or target)
        seen: set[str] = set()
        scan_urls: list[str] = []
        for item in scan_items:
            url = item if item.startswith(("http://", "https://")) else urllib.parse.urljoin(base or "http://localhost/", item)
            if _norm_url(url) in seen or _is_excluded(url, ex_urls, ex_paths):
                continue
            seen.add(_norm_url(url))
            scan_urls.append(url)
        scan_urls = scan_urls[:_HARD_CAP]
        log(f"Taranacak liste modu: {len(scan_urls)} URL taranacak (diğer tarama parametreleri yok sayılıyor).")
        for url in scan_urls:
            page = _fetch_page(url, log)
            if page:
                pages.append(page)
    else:
        base = target_to_url(parameters.get("target_url") or target)
        if not base:
            return {"ok": False, "tool": "ai-osint", "error": "Hedef URL veya taranacak sayfa listesi gerekli."}
        include_sub = _truthy(parameters.get("include_subpages"), True)
        to_visit = [base]
        if include_sub:
            for path in _split_paths(parameters.get("extra_paths")):
                to_visit.append(urllib.parse.urljoin(base, path))
            prior = _prior_discovered_urls(base, target)
            if prior:
                log(f"Önceki dirb/ffuf/gobuster taramalarından {len(prior)} alt yol dahil edildi.")
                to_visit.extend(prior)

        seen = set()
        while to_visit and len(pages) < max_pages:
            url = to_visit.pop(0)
            key = _norm_url(url)
            if key in seen:
                continue
            seen.add(key)
            # Excluded pages are skipped and do NOT consume the page budget.
            if _is_excluded(url, ex_urls, ex_paths):
                continue
            page = _fetch_page(url, log)
            if page is None:
                continue
            pages.append(page)
            if include_sub:
                for link in _links(base, page.get("html") or ""):
                    if _norm_url(link) not in seen and len(to_visit) < _HARD_CAP * 2:
                        to_visit.append(link)

    if not pages:
        return {
            "ok": False, "tool": "ai-osint", "target": base,
            "error": "Hiçbir sayfa getirilemedi. Hedefe erişim yok, kapalı ya da engelli olabilir.",
        }

    # Full text feeds the regex recall floor; a capped corpus feeds the AI.
    full_text = "\n".join(p["text"] for p in pages if p.get("text"))
    corpus = "\n\n".join(f"URL: {p['url']}\n{p['text'][:8000]}" for p in pages if p.get("text"))[:24000]
    regex_emails = _merge_unique(_EMAIL.findall(full_text))
    regex_phones = _merge_unique(p for p in _PHONE.findall(full_text) if len(re.sub(r"\D", "", p)) >= 9)

    log("Yapay zeka toplanan içeriği analiz ediyor...")
    raw = _ollama_chat(_build_prompt(base, corpus, focus), expect_json=True, num_predict=1200)
    findings = _parse_findings(raw)
    ai_available = bool(findings)

    urls_file = _save_scanned_urls_xml(base, [p["url"] for p in pages])

    result = {
        "ok": True,
        "tool": "ai-osint",
        "target": base,
        "pages_scanned": len(pages),
        "scanned_urls_file": urls_file,
        "ai_available": ai_available,
    }
    for key in _RESULT_KEYS:
        if key in findings:
            result[key] = findings[key]
    result["emails"] = _merge_unique(findings.get("emails"), regex_emails)
    result["phones"] = _merge_unique(findings.get("phones"), regex_phones)
    if not result["emails"]:
        result.pop("emails")
    if not result["phones"]:
        result.pop("phones")

    if not result.get("summary"):
        result["summary"] = (
            "Yapay zeka analizi tamamlandı." if ai_available
            else "Yapay zeka yanıtı alınamadı (model kapalı/zaman aşımı). E-posta/telefon bulguları desen tabanlı çıkarıldı."
        )
    result["risk_level"] = findings.get("risk_level", "medium")
    return result
