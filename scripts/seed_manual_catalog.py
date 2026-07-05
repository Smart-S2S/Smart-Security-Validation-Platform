"""Wipe and rebuild the manual 3-way (3YM) progression catalog.

Deletes the existing manual catalog rows + step scripts (keys restart from 1) and
reseeds a tool-based catalog from the shared tool specs — independent of the YZO
(AI Orchestrator) ai_operations tables.

Run:  ./venv/bin/python -m scripts.seed_manual_catalog
"""

from __future__ import annotations

from backend.services.manual_catalog_store import rebuild_manual_catalog


def main() -> None:
    result = rebuild_manual_catalog()
    print(f"Manual catalog rebuilt: {result}")


if __name__ == "__main__":
    main()
