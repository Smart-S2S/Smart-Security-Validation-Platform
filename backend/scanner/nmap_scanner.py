"""Compatibility wrapper for moved nmap scanner module."""

from backend.modules.test.scanners.nmap_scanner import parse_nmap_xml, run_nmap_scan

__all__ = ["run_nmap_scan", "parse_nmap_xml"]
