# Documentation Map

Last updated: March 22, 2026

Use this file as the entry point for repo documentation.

## Current Docs

- `../README.md`
  - project overview, local setup, API overview, and high-level schema notes
- `admin-service-packages.md`
  - current service-package admin model, payload behavior, and storage mapping
- `deployment-aws-ec2.md`
  - current single-server EC2 deployment runbook
- `deployment-namecheap-vps.md`
  - VPS migration/deployment runbook with placeholder production-domain values
- `deploy-automation-ec2.md`
  - GitHub Actions + SSH deployment automation for the EC2 layout
- `pre-cutover-checklist.md`
  - launch-day cutover checklist
- `cutover-command-sheet.md`
  - command-focused cutover reference
- `../api/flask_api/config/MENU_DB_MAINTENANCE.md`
  - unified menu/service-package schema maintenance, sync commands, and SQL validation queries
- `../client/README.md`
  - frontend routes, gallery behavior, and client test entry points

## Reference Docs

- `color-scheme-trials.md`
  - archived theme exploration and selected palette reference for future UI tuning

## Documentation Guidelines

- Treat runtime data as DB-backed unless a doc explicitly describes a fallback/seed file.
- Prefer placeholder domains such as `your-production-domain.com` in operational docs unless the committed repository truly owns a fixed public domain.
- When product behavior changes, update both the root README and the closest feature/runbook doc in `docs/`.
