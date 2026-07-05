"""DEPRECATED — the tool wrappers now live in the AI Orchestrator's own catalog.

Historically this script registered the Kali/pentest tool wrappers as manual
``step_items`` in the 3-way (scan/attack/remediation) flow. As of the 2026-07
separation, those tools belong to the AI Orchestrator's INDEPENDENT catalog
(``ai_operations`` tables), and the tool specs themselves live in
``backend/services/pentest_tool_specs.py``.

This shim now delegates to ``scripts.seed_ai_operations`` so any existing habit or
automation keeps working without re-polluting the manual catalog.

Run:  ./venv/bin/python -m scripts.seed_ai_operations   (preferred)
"""

from __future__ import annotations

from scripts.seed_ai_operations import main


if __name__ == "__main__":
    print("[deprecated] delegating to scripts.seed_ai_operations ...")
    main()
