"""Wordlist (sözlük) catalog store.

Keeps a database catalog of wordlists available on the host: ones discovered by
scanning well-known tool/OS directories, and ones uploaded through the UI. The
catalog feeds the settings "Sözlük Yönetimi" panel and the wordlist selectbox
shown on every YZO/3YM operation that asks for a wordlist.

No AI, no shell — pure filesystem walk + DB upsert.
"""

from __future__ import annotations

import os
import re
import subprocess
import threading
from datetime import datetime, timezone
from pathlib import Path

from backend.services.mysql_db import init_mysql_schema, mysql_conn


_LOCK = threading.Lock()
_STORE_READY = False

# Where uploaded wordlists are stored (owned by the app, safe to write).
_UPLOAD_DIR = Path(__file__).resolve().parents[2] / "data" / "wordlists"

# Well-known locations that ship wordlists on Ubuntu/Kali and common tools.
_SCAN_ROOTS = (
    "/usr/share/wordlists",
    "/usr/share/seclists",
    "/usr/share/SecLists",
    "/usr/share/dirb/wordlists",
    "/usr/share/dirbuster/wordlists",
    "/usr/share/wfuzz/wordlist",
    "/usr/share/metasploit-framework/data/wordlists",
    "/usr/share/john",
    "/usr/share/ncrack",
    "/usr/share/nmap/nselib/data",
    "/usr/share/set/src/fasttrack/wordlist.txt",
)

# File extensions treated as wordlists during a scan.
_WORDLIST_EXTS = {".txt", ".lst", ".dic", ".dict", ".words", ".fuzz", ".wordlist"}

# Safety cap so a scan of a huge SecLists tree cannot insert unbounded rows.
_SCAN_FILE_LIMIT = 5000

# Uploaded filenames are sanitised to this charset.
_SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_upload_dir() -> Path:
    _UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    return _UPLOAD_DIR


def init_wordlist_store() -> None:
    # Schema init (CREATE TABLE IF NOT EXISTS for every table) is ~600ms and is a
    # no-op after the first run, so guard it: run once per process. Without this,
    # every /validation/wordlists call (the wordlist combobox on operation forms)
    # would pay the full schema-init cost instead of just the ~60ms SELECT.
    global _STORE_READY
    if _STORE_READY:
        return
    with _LOCK:
        if _STORE_READY:
            return
        init_mysql_schema()
        _ensure_upload_dir()
        _STORE_READY = True


def human_size(num_bytes: int) -> str:
    size = float(max(int(num_bytes or 0), 0))
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if size < 1024 or unit == "TB":
            if unit == "B":
                return f"{int(size)} {unit}"
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} TB"


# Directory names under /usr/share that are shared buckets, not a tool — when
# the tool segment is one of these, the real tool is the next segment down.
_GENERIC_DIRS = {"wordlists", "wordlist", "share"}


def _tool_from_path(path: str) -> str:
    """Best-effort tool name for a scanned wordlist, from its /usr/share path.

    /usr/share/dirb/... -> "dirb"; /usr/share/nmap/nselib/data/... -> "nmap";
    /usr/share/wordlists/dirb/common.txt -> "dirb" (wordlists is a shared bucket,
    so the subdir is the tool); /usr/share/wordlists/rockyou.txt -> "wordlists".
    Falls back to the immediate parent directory when the path is not under
    /usr/share.
    """
    parts = [p for p in str(path or "").split(os.sep) if p]
    if "share" in parts:
        idx = parts.index("share")
        tool = parts[idx + 1] if idx + 1 < len(parts) - 1 else ""
        # A shared bucket (wordlists/): the tool is the following directory, if
        # that following segment is a directory (not the file itself).
        if tool in _GENERIC_DIRS and idx + 2 < len(parts) - 1:
            tool = parts[idx + 2]
        if tool:
            return tool
    return os.path.basename(os.path.dirname(str(path or ""))) or "root"


def _display_name(path: str, source: str) -> str:
    """Catalog display name.

    - Scanned wordlists are prefixed with their tool, e.g.
      /usr/share/wordlists/dirb/common.txt -> "dirb.common.txt".
    - Uploaded wordlists are prefixed with "loaded.", e.g. a file saved as
      name_1.txt -> "loaded.name_1.txt".

    Derived from the (stable) path, so re-running is idempotent — never stacks
    prefixes.
    """
    base = os.path.basename(str(path or ""))
    if source == "upload":
        return f"loaded.{base}"
    return f"{_tool_from_path(path)}.{base}"


def _row_to_item(row: dict) -> dict:
    size_bytes = int(row.get("size_bytes") or 0)
    return {
        "id": int(row["id"]),
        "name": row.get("name", ""),
        "path": row.get("path", ""),
        "size_bytes": size_bytes,
        "size_h": human_size(size_bytes),
        "source": row.get("source", "scan"),
    }


def list_wordlists() -> list[dict]:
    init_wordlist_store()
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, path, size_bytes, source
                FROM wordlists
                ORDER BY name ASC, path ASC
                """
            )
            rows = cur.fetchall() or []
    return [_row_to_item(row) for row in rows]


def _upsert_wordlist(cur, *, name: str, path: str, size_bytes: int, source: str) -> bool:
    """Insert or refresh a wordlist row keyed by path. Returns True if newly added."""
    now = _utc_now_iso()
    cur.execute("SELECT id FROM wordlists WHERE path = %s LIMIT 1", (path,))
    existing = cur.fetchone()
    if existing:
        cur.execute(
            """
            UPDATE wordlists
            SET name = %s, size_bytes = %s, updated_at = %s
            WHERE id = %s
            """,
            (name, int(size_bytes), now, int(existing["id"])),
        )
        return False
    cur.execute(
        """
        INSERT INTO wordlists (name, path, size_bytes, source, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        (name, path, int(size_bytes), source, now, now),
    )
    return True


def _iter_candidate_files():
    """Yield (name, abspath, size_bytes) for wordlist-like files under known roots.

    Symlinks are followed (``/usr/share/wordlists`` is mostly symlinks to the real
    tool directories — dirb, dirbuster, seclists, metasploit, wfuzz…), with a
    per-scan guard on already-visited real directories so a circular link cannot
    make the walk loop forever.
    """
    seen_paths: set[str] = set()
    visited_dirs: set[str] = set()
    emitted = 0
    for root in _SCAN_ROOTS:
        if emitted >= _SCAN_FILE_LIMIT:
            break
        if not os.path.exists(root):
            continue

        # A root can point directly at a file (e.g. fasttrack wordlist.txt).
        if os.path.isfile(root):
            candidates = [root]
            walker = ()
        else:
            candidates = []
            walker = os.walk(root, followlinks=True)

        for existing_file in candidates:
            item = _stat_candidate(existing_file, seen_paths, require_ext=False)
            if item:
                emitted += 1
                yield item
                if emitted >= _SCAN_FILE_LIMIT:
                    return

        for dirpath, dirnames, filenames in walker:
            # Cycle guard: skip a directory whose real path we already walked, and
            # prune already-visited subdirs so followlinks cannot spin on a loop.
            try:
                real_dir = os.path.realpath(dirpath)
            except OSError:
                real_dir = dirpath
            if real_dir in visited_dirs:
                dirnames[:] = []
                continue
            visited_dirs.add(real_dir)
            dirnames[:] = [
                d for d in dirnames
                if os.path.realpath(os.path.join(dirpath, d)) not in visited_dirs
            ]
            for filename in filenames:
                if emitted >= _SCAN_FILE_LIMIT:
                    return
                item = _stat_candidate(os.path.join(dirpath, filename), seen_paths, require_ext=True)
                if item:
                    emitted += 1
                    yield item


def _stat_candidate(full_path: str, seen_paths: set[str], *, require_ext: bool):
    try:
        abspath = os.path.realpath(full_path)
    except OSError:
        return None
    if abspath in seen_paths:
        return None
    if require_ext and os.path.splitext(abspath)[1].lower() not in _WORDLIST_EXTS:
        return None
    try:
        if not os.path.isfile(abspath):
            return None
        size_bytes = os.path.getsize(abspath)
    except OSError:
        return None
    if size_bytes <= 0:
        return None
    seen_paths.add(abspath)
    return os.path.basename(abspath), abspath, size_bytes


def scan_system_wordlists() -> dict:
    """Walk known wordlist directories and upsert every match into the catalog."""
    init_wordlist_store()
    found = 0
    added = 0
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            for _base, path, size_bytes in _iter_candidate_files():
                found += 1
                if _upsert_wordlist(cur, name=_display_name(path, "scan"), path=path, size_bytes=size_bytes, source="scan"):
                    added += 1
        conn.commit()

    total = len(list_wordlists())
    return {
        "found": found,
        "added": added,
        "updated": found - added,
        "total": total,
        "truncated": found >= _SCAN_FILE_LIMIT,
    }


def _unique_upload_path(original_name: str) -> tuple[str, Path]:
    """Resolve a non-colliding filename in the upload dir.

    If ``foo.txt`` exists, returns ``foo_1.txt``, then ``foo_2.txt``, and so on,
    so the name stays unique both on disk and in the catalog.
    """
    _ensure_upload_dir()
    cleaned = _SAFE_NAME.sub("_", os.path.basename(original_name or "").strip()) or "wordlist.txt"
    stem, ext = os.path.splitext(cleaned)
    if ext.lower() != ".txt":
        ext = ".txt"
    if not stem:
        stem = "wordlist"

    candidate_name = f"{stem}{ext}"
    candidate_path = _UPLOAD_DIR / candidate_name
    counter = 1
    while candidate_path.exists():
        candidate_name = f"{stem}_{counter}{ext}"
        candidate_path = _UPLOAD_DIR / candidate_name
        counter += 1
    return candidate_name, candidate_path


def add_uploaded_wordlist(original_name: str, data: bytes) -> dict:
    init_wordlist_store()
    if not data:
        raise ValueError("Yüklenen sözlük dosyası boş.")

    _disk_name, dest_path = _unique_upload_path(original_name)
    dest_path.write_bytes(data)
    size_bytes = dest_path.stat().st_size
    name = _display_name(str(dest_path), "upload")

    with mysql_conn() as conn:
        with conn.cursor() as cur:
            _upsert_wordlist(
                cur,
                name=name,
                path=str(dest_path),
                size_bytes=size_bytes,
                source="upload",
            )
        conn.commit()

    return {
        "name": name,
        "path": str(dest_path),
        "size_bytes": size_bytes,
        "size_h": human_size(size_bytes),
        "source": "upload",
    }


def migrate_wordlist_names() -> int:
    """Rename existing catalog rows to the prefixed naming scheme.

    Recomputes `name` from each row's path + source, so it is idempotent and
    never double-prefixes. Returns the number of rows actually renamed.
    """
    init_wordlist_store()
    updated = 0
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, name, path, source FROM wordlists")
            rows = cur.fetchall() or []
            now = _utc_now_iso()
            for row in rows:
                new_name = _display_name(row.get("path", ""), row.get("source", "scan"))
                if new_name != row.get("name"):
                    cur.execute(
                        "UPDATE wordlists SET name = %s, updated_at = %s WHERE id = %s",
                        (new_name, now, int(row["id"])),
                    )
                    updated += 1
        conn.commit()
    return updated


# --------------------------------------------------------------------------- #
# Downloadable wordlist collections (admin, from the Sözlük Yönetimi panel)
# --------------------------------------------------------------------------- #
# The actual download commands live in the root helper (/usr/local/sbin/ssvp-pkg,
# allowlisted in sudoers); here we only keep display metadata. The download
# targets land under directories already covered by _SCAN_ROOTS, so the post-
# download scan folds them straight into the catalog.
SSVP_PKG = "/usr/local/sbin/ssvp-pkg"
_WORDLIST_INSTALLERS = {
    "rockyou": {
        "label": "rockyou.txt",
        "note": "≈133 MB — /usr/share/wordlists/rockyou.txt",
    },
    "seclists": {
        "label": "SecLists",
        "note": "≈1 GB — /usr/share/seclists (git)",
    },
}

_INSTALL_LOCK = threading.Lock()
_INSTALL_JOBS: dict[str, dict] = {}


def _run_install_script(name: str) -> tuple[bool, str]:
    if name not in _WORDLIST_INSTALLERS:
        return False, "Bilinmeyen sözlük paketi."
    try:
        proc = subprocess.run(
            ["sudo", "-n", SSVP_PKG, "wordlist-install", name],
            timeout=3600, capture_output=True, text=True,
        )
        out = (proc.stdout or "") + (proc.stderr or "")
        if proc.returncode != 0 and ("a password is required" in out or "sudo:" in out):
            out += "\nSunucuda parolasız sudo yok (install.py'yi tekrar çalıştırın)."
        return proc.returncode == 0, out
    except subprocess.TimeoutExpired:
        return False, "İndirme zaman aşımına uğradı."
    except Exception as exc:
        return False, f"Hata: {type(exc).__name__}: {exc}"


def _install_worker(name: str) -> None:
    ok, out = _run_install_script(name)
    scan_summary = None
    if ok:
        try:
            scan_summary = scan_system_wordlists()
        except Exception as exc:  # pragma: no cover - defensive
            ok = False
            out += f"\nTarama hatası: {exc}"
    with _INSTALL_LOCK:
        job = _INSTALL_JOBS.get(name, {})
        job.update({
            "status": "done" if ok else "error",
            "ok": ok,
            "finished_at": _utc_now_iso(),
            "message": (out or "").strip()[-2000:],
            "scan": scan_summary,
        })
        _INSTALL_JOBS[name] = job


def start_wordlist_install(name: str) -> dict:
    """Kick off a background download+catalog of a known collection. Idempotent
    while a job is already running for the same collection."""
    if name not in _WORDLIST_INSTALLERS:
        raise ValueError("Bilinmeyen sözlük paketi.")
    with _INSTALL_LOCK:
        current = _INSTALL_JOBS.get(name)
        if current and current.get("status") == "running":
            return dict(current)
        job = {
            "name": name,
            "label": _WORDLIST_INSTALLERS[name]["label"],
            "status": "running",
            "started_at": _utc_now_iso(),
        }
        _INSTALL_JOBS[name] = job
    threading.Thread(target=_install_worker, args=(name,), daemon=True).start()
    return dict(job)


# Marker paths that tell us a collection is already present on disk.
_WORDLIST_INSTALLED_MARKERS = {
    "rockyou": "/usr/share/wordlists/rockyou.txt",
    "seclists": "/usr/share/seclists/.git",
}


def _is_installed(name: str) -> bool:
    marker = _WORDLIST_INSTALLED_MARKERS.get(name)
    return bool(marker) and os.path.exists(marker)


def wordlist_install_catalog() -> list[dict]:
    """The collections the panel can offer to download (with install state so the
    UI can switch the button to an 'update' / diff-refresh action)."""
    return [
        {"name": k, "label": v["label"], "note": v.get("note", ""), "installed": _is_installed(k)}
        for k, v in _WORDLIST_INSTALLERS.items()
    ]


def wordlist_install_status() -> dict:
    with _INSTALL_LOCK:
        jobs = {k: dict(v) for k, v in _INSTALL_JOBS.items()}
    return {"available": wordlist_install_catalog(), "jobs": jobs}


def delete_wordlist(wordlist_id: int) -> bool:
    init_wordlist_store()
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, path, source FROM wordlists WHERE id = %s LIMIT 1", (int(wordlist_id),))
            row = cur.fetchone()
            if not row:
                return False
            cur.execute("DELETE FROM wordlists WHERE id = %s", (int(wordlist_id),))
            # Only remove the file when it is one we uploaded into our own dir.
            if row.get("source") == "upload":
                try:
                    file_path = Path(row["path"]).resolve()
                    if file_path.is_file() and _UPLOAD_DIR.resolve() in file_path.parents:
                        file_path.unlink()
                except OSError:
                    pass
        conn.commit()
    return True
