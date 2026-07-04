# SSVP Agent Contract

This repository is a defensive Security Validation platform.

## Mission Boundaries
- Defensive use only.
- Authorized pentest in owned/lab systems only.
- No third-party attack operations.
- Focus on validation, hardening, remediation, retest, and reporting.

## Core Workflow
1. Discovery / Scan
2. Validation Plan
3. Evidence & Risk Analysis
4. Remediation Plan
5. Retest
6. Report

## Architecture Constraints
- Keep `main.py` minimal.
- FastAPI routers must be registered with `include_router`.
- Routes in `backend/routes`.
- Business logic in `backend/services`.
- AI logic in `backend/ai`.
- Tool execution in `backend/tools`.

## Tooling and AI Constraints
- AI must not generate terminal command strings or binary paths.
- AI returns only action intents.
- Canonical intent format:
  - `action`: action key in Tool Registry
  - `target`: authorized target label/value
  - `reason`: defensive rationale
  - `parameters`: user-editable parameter object
- Tool definitions are NOT stored in JSON files.
- Tool definitions are stored in MySQL Tool Registry.
- Backend resolves action key to tool metadata:
  - tool name
  - module/path mapping
  - command template
  - risk level
  - approval requirement

## Approval Policy
- Active validation/attack-style actions require explicit user approval.
- User can edit parameters in UI before execution.
- Backend must enforce approval checks before runner execution.

## Quality Standards
- Production-ready code.
- Modular, readable, extensible implementation.
- Refactor existing structure instead of full rewrite.
