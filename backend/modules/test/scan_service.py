import time

from backend.i18n import t
from backend.modules.test.scanners.nmap_scanner import run_nmap_scan
from backend.modules.test.scanners.masscan_scanner import run_masscan_scan
from backend.modules.test.scanners.netdiscover_scanner import run_netdiscover_scan
from backend.ai.ollama_client import analyze_ports_with_ai
from backend.services.job_store import add_log, set_result, set_status


def run_scan_job(
    job_id: str,
    target: str,
    scan_tool: str,
    scan_params: list[str] | None = None,
    scan_ports: list[str] | None = None,
    language: str = "tr",
):
    set_status(job_id, "running")

    selected_params = scan_params or []
    selected_ports = scan_ports or []

    add_log(job_id, t(language, "scan.job.tool", "Seçilen araç: {tool}").replace("{tool}", scan_tool))
    add_log(job_id, t(language, "scan.job.paramCount", "Seçilen parametre sayısı: {count}").replace("{count}", str(len(selected_params))))
    add_log(job_id, t(language, "scan.job.portCount", "Seçilen port sayısı: {count}").replace("{count}", str(len(selected_ports))))

    if scan_tool == "nmap":
        add_log(job_id, t(language, "scan.job.nmap.start", "Nmap ile host ve servis taraması başlatılıyor..."))
        result = run_nmap_scan(target, job_id=job_id, scan_params=selected_params, scan_ports=selected_ports, language=language)
    elif scan_tool == "masscan":
        add_log(job_id, t(language, "scan.job.masscan.start", "Masscan ile port taraması başlatılıyor..."))
        result = run_masscan_scan(target, job_id=job_id, scan_params=selected_params, scan_ports=selected_ports, language=language)
    elif scan_tool == "netdiscover":
        add_log(job_id, t(language, "scan.job.netdiscover.start", "netdiscover ile host keşfi başlatılıyor..."))
        result = run_netdiscover_scan(target, job_id=job_id, scan_params=selected_params, scan_ports=selected_ports, language=language)
    else:
        result = {"error": t(language, "scan.job.unsupportedTool", "Desteklenmeyen tarama aracı.")}

    result["scan_tool"] = scan_tool
    result["selected_params"] = selected_params
    result["selected_ports"] = selected_ports

    if not result.get("error") and scan_tool == "nmap":
        add_log(job_id, t(language, "scan.job.analyzing", "Bulgular yorumlanıyor..."))
        ai_analysis = analyze_ports_with_ai(result, language=language)
        result["ai_analysis"] = ai_analysis
        add_log(job_id, t(language, "scan.job.analysisDone", "Analiz tamamlandı."))
    elif not result.get("error"):
        result["ai_analysis"] = t(language, "scan.job.aiDisabled", "Bu araç için AI yorum adımı henüz aktif değil.")

    add_log(job_id, t(language, "scan.job.processing", "Tarama sonucu işleniyor..."))
    time.sleep(0.5)

    set_result(job_id, result)
    set_status(job_id, "finished")
    add_log(job_id, t(language, "scan.job.finished", "Tarama tamamlandı."))
