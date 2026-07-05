"""Seed the AI Orchestrator (YZO) independent operation catalog.

Regenerates every tool operation into the ``ai_operations`` / ``ai_operation_params``
tables and writes their wrapper scripts under ``data/ai_operations/``. Also retires
the legacy Kali tool wrappers from the manual 3-way ``step_items`` flow, so the AI
Orchestrator is fully separated from manual selection.

Run:  ./venv/bin/python -m scripts.seed_ai_operations
"""

from __future__ import annotations

from backend.services.ai_operations_store import (
    deactivate_manual_kali_catalog,
    seed_operations,
)


def main() -> None:
    result = seed_operations()
    print(f"AI operations seeded: {result.get('seeded', 0)}")
    cleanup = deactivate_manual_kali_catalog()
    print(f"Manual Kali catalog deactivated: {cleanup}")
    print("Done.")


if __name__ == "__main__":
    main()
