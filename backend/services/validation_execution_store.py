import threading
import time
import uuid


_LOCK = threading.Lock()
_EXECUTIONS: dict[str, dict] = {}


def _now_hms() -> str:
    return time.strftime("%H:%M:%S")


def create_execution(*, step_key: str, action: str, target: str, created_by: int | None) -> str:
    execution_id = str(uuid.uuid4())
    with _LOCK:
        _EXECUTIONS[execution_id] = {
            "execution_id": execution_id,
            "step_key": (step_key or "").strip().lower(),
            "action": (action or "").strip().lower(),
            "target": (target or "").strip(),
            "created_by": created_by,
            "status": "queued",
            "current_step": "queued",
            "logs": [],
            "result": None,
            "error": "",
        }
    return execution_id


def append_log(execution_id: str, message: str) -> None:
    text = str(message or "").strip()
    if not text:
        return

    with _LOCK:
        item = _EXECUTIONS.get(execution_id)
        if not item:
            return

        item["current_step"] = text
        item["logs"].append({
            "time": _now_hms(),
            "message": text,
        })


def set_status(execution_id: str, status: str, current_step: str | None = None) -> None:
    with _LOCK:
        item = _EXECUTIONS.get(execution_id)
        if not item:
            return

        item["status"] = (status or "unknown").strip().lower()
        if current_step:
            item["current_step"] = str(current_step).strip()


def set_result(execution_id: str, result: dict) -> None:
    with _LOCK:
        item = _EXECUTIONS.get(execution_id)
        if not item:
            return
        item["result"] = result or {}


def set_error(execution_id: str, error_text: str) -> None:
    with _LOCK:
        item = _EXECUTIONS.get(execution_id)
        if not item:
            return
        item["error"] = str(error_text or "").strip()


def get_execution(execution_id: str) -> dict | None:
    with _LOCK:
        item = _EXECUTIONS.get(execution_id)
        if not item:
            return None

        return {
            "execution_id": item["execution_id"],
            "step_key": item["step_key"],
            "action": item["action"],
            "target": item["target"],
            "created_by": item["created_by"],
            "status": item["status"],
            "current_step": item["current_step"],
            "logs": list(item["logs"]),
            "result": dict(item["result"] or {}),
            "error": item["error"],
        }
