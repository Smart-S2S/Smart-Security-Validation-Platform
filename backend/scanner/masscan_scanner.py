"""Compatibility wrapper for moved masscan scanner module."""

from backend.modules.test.scanners.masscan_scanner import run_masscan_scan

__all__ = ["run_masscan_scan"]
