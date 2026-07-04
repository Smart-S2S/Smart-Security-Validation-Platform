from backend.i18n import t


def guard_attack_operation(language: str = "tr") -> dict:
    # Placeholder guard to centralize attack-module responses until concrete operations are added.
    return {
        "ok": False,
        "message": t(language, "attack.notImplemented", "Atak modulu henuz aktif degil."),
    }
