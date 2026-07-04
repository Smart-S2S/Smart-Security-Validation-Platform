import time

from backend.i18n import t

jobs = {}


def create_job(
    job_id: str,
    target: str,
    scan_tool: str = "nmap",
    scan_params: list[str] | None = None,
    scan_ports: list[str] | None = None,
    language: str = "tr",
):
    jobs[job_id] = {
        "status": "queued",
        "target": target,
        "scan_tool": scan_tool,
        "scan_params": scan_params or [],
        "scan_ports": scan_ports or [],
        "language": language,
        "current_step": t(language, "scan.job.queued", "Kuyruğa alındı."),
        "logs": [],
        "result": None,
    }
    add_log(job_id, t(language, "scan.job.queued", "Tarama kuyruğa alındı."))


def add_log(job_id: str, message: str):
    if job_id not in jobs:
        return

    jobs[job_id]["current_step"] = message
    jobs[job_id]["logs"].append({
        "time": time.strftime("%H:%M:%S"),
        "message": message
    })


def set_status(job_id: str, status: str):
    if job_id in jobs:
        jobs[job_id]["status"] = status


def set_result(job_id: str, result: dict):
    if job_id in jobs:
        jobs[job_id]["result"] = result


def get_job(job_id: str):
    return jobs.get(job_id)
