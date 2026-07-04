from backend.i18n import t


def guard_remediation_operation(language: str = "tr") -> dict:
    # Placeholder guard to centralize remediation-module responses until concrete operations are added.
    return {
        "ok": False,
        "message": t(language, "remediation.notImplemented", "Duzeltme modulu henuz aktif degil."),
    }
