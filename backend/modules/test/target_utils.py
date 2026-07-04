import re

from backend.i18n import t


_SAFE_TOKEN_RE = re.compile(r"^[A-Za-z0-9._:/-]+$")


def split_targets(raw_target: str) -> list[str]:
    tokens = []
    for piece in raw_target.replace(";", " ").replace(",", " ").split():
        cleaned = piece.strip()
        if cleaned:
            tokens.append(cleaned)

    return list(dict.fromkeys(tokens))


def validate_target_tokens(target_tokens: list[str], language: str = "tr") -> str | None:
    if not target_tokens:
        return t(language, "scan.target.empty", "Hedef bos olamaz.")

    if len(target_tokens) > 128:
        return t(language, "scan.target.tooMany", "Tek taramada en fazla 128 hedef girebilirsiniz.")

    for token in target_tokens:
        if token.startswith("-"):
            return t(language, "scan.target.invalidPrefix", "Hedef '-' ile baslayamaz.")

        if len(token) > 255:
            return t(language, "scan.target.tooLong", "Hedef girdisi cok uzun.")

        if not _SAFE_TOKEN_RE.fullmatch(token):
            return t(language, "scan.target.invalidChars", "Hedef girdisinde gecersiz karakter var.")

    return None
