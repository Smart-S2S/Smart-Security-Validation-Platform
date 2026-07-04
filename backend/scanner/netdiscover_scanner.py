"""Compatibility wrapper for moved netdiscover scanner module."""

from backend.modules.test.scanners.netdiscover_scanner import run_netdiscover_scan

__all__ = ["run_netdiscover_scan"]
