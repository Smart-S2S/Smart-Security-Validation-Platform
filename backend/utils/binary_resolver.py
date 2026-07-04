from pathlib import Path
from shutil import which


COMMON_BINARY_DIRECTORIES = (
    "/usr/local/sbin",
    "/usr/local/bin",
    "/usr/sbin",
    "/usr/bin",
    "/sbin",
    "/bin",
    "/snap/bin",
)


def resolve_binary(command_name: str, extra_candidates: tuple[str, ...] = ()) -> str | None:
    """Resolve an executable path even when PATH is narrowed by service environments."""
    if "/" in command_name:
        command_path = Path(command_name)
        if command_path.is_file():
            return str(command_path)
        return None

    binary = which(command_name)
    if binary:
        return binary

    checked: set[str] = set()

    for candidate in extra_candidates:
        if candidate in checked:
            continue
        checked.add(candidate)
        if Path(candidate).is_file():
            return candidate

    for directory in COMMON_BINARY_DIRECTORIES:
        candidate = str(Path(directory) / command_name)
        if candidate in checked:
            continue
        checked.add(candidate)
        if Path(candidate).is_file():
            return candidate

    return None
