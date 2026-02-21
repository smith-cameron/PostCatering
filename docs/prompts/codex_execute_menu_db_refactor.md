# Codex Task Prompt: Execute Menu DB Refactor + Backend Cutover (No Legacy Cleanup Yet)

Use this exact repo and branch:
- Repo: `PostCatering`
- Branch: `feature/menu-refactor-v2` (based on `develop`)
- Do not push unless I explicitly ask.

## Goal
Execute the prepared DB migration SQL file, ensure Python backend reads/writes the new simplified menu structure, run backend tests, and then hand off a manual QA checklist. Do not remove legacy tables or legacy code paths in this task.

## Required SQL File
Run this file (review first, then execute):
- `api/sql/migrations/20260221_menu_simplified_structure.sql`

## Guardrails
1. Confirm current branch is `feature/menu-refactor-v2` before any DB action.
2. Do not drop/deprecate legacy DB tables in this task.
3. Do not delete legacy backend code paths in this task.
4. Keep fallback behavior available if simplified tables are empty.
5. No git push.

## Execution Steps
1. Validate branch/status and report current HEAD commit.
2. Open and review `api/sql/migrations/20260221_menu_simplified_structure.sql`.
3. Execute SQL in a transaction against the configured local DB.
4. Confirm migration results with validation queries:
   - row counts for new tables
   - duplicate key checks
   - FK orphan checks
   - non-negative general prices
5. Verify backend endpoints are wired to simplified structure:
   - `/api/menu/general/groups`
   - `/api/menu/general/items`
   - `/api/menu/formal/groups`
   - `/api/menu/formal/items`
   - `/api/menus` should resolve from simplified DB first, with legacy fallback.
6. Run tests (use project venv Python):
   - `api.tests.test_menu_simplified_service`
   - `api.tests.test_menu_constraints`
   - `api.tests.test_api_endpoints_integration`
   - plus any additional targeted menu tests you add/update.
7. Share concise output summary:
   - what SQL ran
   - table counts
   - test results
   - any blockers or inconsistencies
8. Provide a manual QA checklist for me to run next.
9. Stop there and wait for my sign-off before any legacy cleanup task.

## Deliverables
1. List of files changed.
2. Exact commands run (SQL + tests).
3. Test pass/fail summary.
4. Manual QA checklist.
5. Explicit statement: legacy cleanup deferred until instructed.
