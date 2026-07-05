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
import threading
from datetime import datetime, timezone
from pathlib import Path

from backend.services.mysql_db import init_mysql_schema, mysql_conn


_LOCK = threading.Lock()

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
    with _LOCK:
        init_mysql_schema()
        _ensure_upload_dir()


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
    """Yield (name, abspath, size_bytes) for wordlist-like files under known roots."""
    seen_paths: set[str] = set()
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
            walker = os.walk(root, followlinks=False)

        for existing_file in candidates:
            item = _stat_candidate(existing_file, seen_paths, require_ext=False)
            if item:
                emitted += 1
                yield item
                if emitted >= _SCAN_FILE_LIMIT:
                    return

        for dirpath, _dirnames, filenames in walker:
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
