# American Legion Post 468 Catering Application

Web application for American Legion Post 468 catering services and community food programs.
This repository includes a React frontend, a Flask backend, and a MySQL data layer for menus, inquiries, and landing slides.

## Mission And Program Context

Food prepared with purpose. American Legion Post 468 Catering combines professional culinary and event experience with a mission to serve the local community. The same team supports events and the weekly Monday Meal Program for veterans, and catering proceeds support veteran outreach.

## Audience

This README is for:
- Developers onboarding to the project
- Future maintainers handling operations and menu updates
- Internal stakeholders who need a technical and program-level overview

## Stack

- Frontend: React + Vite + React Router + React Bootstrap
- Backend: Python + Flask
- Database: MySQL
- Data model: normalized menu-item tables plus service-package tables composed into `/api/menus`

## Repository Layout

```text
PostCatering/
  .github/
    workflows/
      ci.yml
  .pre-commit-config.yaml
  api/
    server.py
    .env.example
    requirements.txt
    flask_api/
      controllers/
      services/
      models/
      validators/
      config/
      static/
        slides/
    sql/
      schema.sql
      menu_seed_payload.json
    scripts/
      menu_admin_sync.py
    tests/
      test_*.py
  client/
    src/
      components/
      hooks/
      test/
    public/
    package.json
    package-lock.json
    vite.config.js
    eslint.config.js
  docs/
    admin-service-packages.md
  README.md
```

Generated/runtime folders such as `api/venv`, `client/node_modules`, and `client/dist` are intentionally omitted.

## Local Development Setup

### Prerequisites

- Node.js 24.x and npm
- Python 3.10+ (3.11 recommended)
- MySQL 8+ (or compatible)

### 1) Backend Setup (`api/`)

```powershell
cd api
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
Copy-Item .env.example .env
```

Populate `.env` with local values (see Environment Variables below).

Initialize schema + seed menu data:

```powershell
python scripts/menu_admin_sync.py --apply-schema --reset
```

Run backend:

```powershell
python server.py
```

Flask defaults to `http://localhost:5000`.

Create or update an admin dashboard user (after schema is applied):

```powershell
cd api
python scripts/create_admin_user.py --username your-admin-username --display-name "Admin User"
```

If you omit `--password`, the script will prompt securely for it.

Alternative (from `client/`):

```powershell
npm run api
```

This uses the client script to start Flask from `../api` via `venv\Scripts\flask run --no-debugger`.

### 2) Frontend Setup (`client/`)

```powershell
cd client
npm install
npm run dev
```

Vite defaults to `http://localhost:5173` and proxies `/api` to `http://localhost:5000`.

## Deployment

- AWS EC2 runbook: `docs/deployment-aws-ec2.md`
- Owner-account launch-day checklist: `docs/pre-cutover-checklist.md`
- Owner-account command sheet: `docs/cutover-command-sheet.md`

## Testing

Backend unit/integration tests:

```powershell
cd api
.\venv\Scripts\python.exe -m unittest discover -s tests -v
```

Frontend component/form tests:

```powershell
cd client
npm run test
```

Browser E2E inquiry smoke test:

```powershell
cd client
npx playwright install chromium
npm run test:e2e
```

The E2E suite launches the frontend dev server automatically and expects backend API to be running locally:
- Frontend (auto-started by Playwright): `http://127.0.0.1:5173`
- Backend API: `http://localhost:5000` (or `http://127.0.0.1:5000`)

Current frontend coverage includes:
- `client/src/components/Landing.test.jsx` (slide API load/fallback)
- `client/src/components/Inquiry.test.jsx` (required validation + successful submit payload)
- `client/src/components/service-menu/CatalogSectionsAccordion.test.jsx` (shared public menu accordion rendering and section promotion)
- `client/src/components/service-menu/serviceMenuUtils.test.js` (filters formal-only items out of non-formal public menu displays)
- `client/src/components/admin/AdminLayout.test.jsx` (routed admin shell and tab navigation)
- `client/src/components/admin/AdminDashboard.test.jsx` (embedded menu/media/settings flows running inside the routed admin shell)
- `client/src/components/admin/AdminServicePlansPage.test.jsx` (service package CRUD and validation flows)
- `client/e2e/customer-inquiry.spec.js` (browser flow from open inquiry modal to successful submission)

## Pre-commit Hooks

Install and enable hooks from the repository root:

```powershell
.\api\venv\Scripts\python.exe -m pre_commit install --install-hooks
.\api\venv\Scripts\python.exe -m pre_commit run --all-files
```

`api/requirements-dev.txt` includes `pre-commit`, so installing backend dev dependencies into `api/venv` keeps the generated hook and its Python interpreter aligned.

Configured hooks:
- Python lint/fix with `ruff` (API files)
- Python formatting with `black` (API files)
- Frontend lint with ESLint (`client/`)

## CI Automation

GitHub Actions workflow:
- `.github/workflows/ci.yml`

Triggers:
- Pushes to `main`
- All pull requests

Checks executed:
- Backend unit/integration tests (`python -m unittest discover -s api/tests -v`)
- Frontend lint (`npm run lint`)
- Frontend tests (`npm run test`)
- Frontend production build (`npm run build`)
- Frontend browser E2E smoke test (`npm run test:e2e`) against Flask + MySQL

## Environment Variables

Use `api/.env.example` as the source of truth for variable names.

- `FLASK_APP`: Flask entry point (`server.py`)
- `FLASK_ENV`: environment (`development` for local)
- `FLASK_SECRET_KEY`: Flask session/secret key
- `SESSION_COOKIE_SAMESITE`: Flask session cookie SameSite setting (`Lax` by default)
- `SESSION_COOKIE_SECURE`: `true`/`false` for secure-only session cookies
- `DB_HOST`: MySQL host
- `DB_PORT`: MySQL port
- `DB_USER`: MySQL user
- `DB_PASSWORD`: MySQL password
- `DB_NAME`: database name
- `CORS_ALLOW_ORIGIN`: allowed frontend origin (for local, usually `http://localhost:5173`)
- `MENU_ADMIN_TOKEN`: token required by admin menu sync endpoint
- `SMTP_HOST`: SMTP server host
- `SMTP_PORT`: SMTP server port
- `SMTP_USERNAME`: SMTP username
- `SMTP_PASSWORD`: SMTP password or app password
- `SMTP_USE_TLS`: `true`/`false` for TLS
- `INQUIRY_TO_EMAIL`: destination inbox for inquiry notifications
- `INQUIRY_FROM_EMAIL`: sender address used by outbound inquiry emails
- `INQUIRY_REPLY_TO_EMAIL`: reply destination for customer confirmation emails (defaults to `INQUIRY_TO_EMAIL`)
- `INQUIRY_CONFIRMATION_ENABLED`: `true`/`false` to send customer confirmation emails
- `INQUIRY_RATE_LIMIT_PER_IP_PER_MINUTE`: short-window inquiry submit limit per client IP
- `INQUIRY_RATE_LIMIT_PER_IP_PER_HOUR`: hourly inquiry submit limit per client IP
- `INQUIRY_DUPLICATE_WINDOW_SECONDS`: duplicate payload suppression window
- `INQUIRY_MAX_LINKS`: max links allowed in inquiry free-text fields
- `INQUIRY_BLOCKED_EMAIL_DOMAINS`: comma-separated blocked email domains
- `INQUIRY_ALLOWED_EMAIL_DOMAINS`: optional allowlist for email domains (empty disables allowlist)
- `INQUIRY_REQUIRE_EMAIL_DOMAIN_DNS`: optional DNS reachability check for email domains
- `INQUIRY_ABUSE_ALERT_THRESHOLD_PER_MINUTE`: threshold for elevated abuse log events
- `INQUIRY_ABUSE_ALERT_WINDOW_SECONDS`: rolling window for abuse alert threshold

Security notes:
- Never commit `.env` files or secret values.
- Rotate `MENU_ADMIN_TOKEN` and SMTP credentials if exposed.
- Keep CORS restricted to known origins.
- Keep anti-automation integrity settings internal and do not publish implementation details.

### Inquiry Email Content Settings

Inquiry email copy is stored in MySQL `menu_config` (single source of truth), using:
- `config_key = inquiry_email_content`
- `config_json` fields:
  - `confirmation_subject`
  - `owner_note`

Default values are used when this record is missing.

Example SQL:

```sql
INSERT INTO menu_config (config_key, config_json)
VALUES (
  'inquiry_email_content',
  JSON_OBJECT(
    'confirmation_subject', 'Post 468 Catering Team - We received your inquiry',
    'owner_note', 'Thank you for reaching out. Our catering staff will follow up with scheduling details shortly.'
  )
)
ON DUPLICATE KEY UPDATE
  config_json = VALUES(config_json),
  updated_at = CURRENT_TIMESTAMP;
```

## API Overview

- `GET /api/health`
  Health check including DB connectivity.

- `GET /api/slides`
  Returns active landing slides.

- `GET /api/assets/slides/<filename>`
  Serves slide assets from backend static storage.

- `GET /api/menus`
  Returns menu payload consumed by the frontend.

- `POST /api/admin/auth/login`
  Starts an authenticated admin session.

- `POST /api/admin/auth/logout`
  Ends the authenticated admin session.

- `GET /api/admin/auth/me`
  Returns current authenticated admin user.

- `GET /api/admin/menu/items`
  Search/filter menu items for admin maintenance.

- `GET /api/admin/menu/items/<id>`
  Returns menu item details + option-group assignment rows.

- `POST /api/admin/menu/items`
  Creates a menu item with option-group assignments.

- `PATCH /api/admin/menu/items/<id>`
  Updates menu item fields and option-group assignments.

- `GET /api/admin/service-plans`
  Returns service package sections plus package rows for the requested catalog (`catering` or `formal`).

- `GET /api/admin/service-plans/<id>`
  Returns a single service package for editing.

- `POST /api/admin/service-plans`
  Creates a service package.

- `PATCH /api/admin/service-plans/<id>`
  Updates a service package.

- `DELETE /api/admin/service-plans/<id>`
  Archives a service package by default; hard delete is explicit.

- `PATCH /api/admin/service-plans/reorder`
  Persists package order within a fixed section.

- `GET /api/admin/media`
  Search/filter gallery/landing media.

- `POST /api/admin/media/upload`
  Uploads image/video assets and creates slide/gallery metadata records.

- `PATCH /api/admin/media/<id>`
  Updates media metadata, slide flag, activation state, and display order.

- `GET /api/admin/audit`
  Returns recent admin edit history.

- `POST /api/inquiries`
  Validates and stores inquiry submissions; attempts SMTP notification.

- `POST /api/admin/menu/sync`
  Protected endpoint for schema apply/reset/seed operations. Requires `MENU_ADMIN_TOKEN` in header.

## API Naming Conventions

- HTTP payloads use `snake_case` for API field names.
- React component/view-model state uses `camelCase`.
- Boundary mapping is enforced in `client/src/hooks/useMenuConfig.js` for `/api/menus`:
  - API fields like `page_title`, `intro_blocks`, `section_id`, `plan_id`, `plan_key`, `selection_mode`, `selection_groups`, `group_key`, `option_key`
  - Client fields like `pageTitle`, `introBlocks`, `sectionId`, `planId`, `planKey`, `selectionMode`, `selectionGroups`, `groupKey`, `optionKey`
  - `tier_title` remains only for formal course-option lists that still render as grouped option blocks
- Inquiry request/response payloads remain `snake_case` end-to-end to align with backend validators and DB fields.

## Admin Dashboard

The admin UI now uses one routed shell (`AdminLayout`) with fixed tabs:
- `/admin/menu-items`
- `/admin/service-packages`
- `/admin/media`
- `/admin/settings`

The visible layout stays uniform across tabs, but each route renders its own page component inside the shared dashboard shell.

## Menu Data And Maintenance

Primary menu source is normalized MySQL tables. Seed source is:
- `api/sql/menu_seed_payload.json`

Maintenance details and SQL examples:
- `api/flask_api/config/MENU_DB_MAINTENANCE.md`
- `docs/admin-service-packages.md`

Key maintenance rule:
- Use `is_active = 0` to hide rows instead of deleting data.

Service packages are stored separately from menu items. Menu dishes stay in the normalized menu tables, while catering/formal packages live in:
- `service_plan_sections`
- `service_plans`
- `service_plan_constraints`
- `service_plan_details`
- `service_plan_selection_groups`
- `service_plan_selection_options`

Important current rules:
- Package sections are fixed operational buckets, not user-managed content.
- Runtime catalogs are `catering` and `formal`.
- `is_active` is the only live package status. Inactive means archived/hidden from public displays and the inquiry flow.

Public menu rendering notes (current UI):
- All public menu pages render through the same accordion pipeline (`CatalogSectionsAccordion` + `MenuSectionBlocks`), so structural display changes should be made there instead of per-menu page.
- Menu accordions default to collapsed.
- Items assigned to the formal catalog are intentionally excluded from `to-go` and `catering` public displays, even if they exist in shared source data.

### Unified Menu And Service Package Model (Current, Updated March 15, 2026)

The current schema separates two domains that used to be mixed together:
- menu items
- service packages

Menu items are still the canonical source for dishes and tray pricing. Service packages are now their own domain with package rules, included items, and customer-choice definitions stored separately.

Picture 1: high-level schema

```text
MENU ITEMS

+------------------+        +------------------+
|    menu_types    |        |    menu_groups   |
|------------------|        |------------------|
| id (PK)          |        | id (PK)          |
| type_key (UQ)    |        | group_key (UQ)   |
| type_name (UQ)   |        | group_name (UQ)  |
| sort_order       |        | sort_order       |
| is_active        |        | is_active        |
+------------------+        +------------------+
         |                           ^
         |                           |
         v                           |
+-----------------------+            |
|   menu_type_groups    |------------+
|-----------------------|
| id (PK)               |
| menu_type_id (FK)     |
| menu_group_id (FK)    |
| display_order         |
| is_active             |
| UQ(menu_type_id,menu_group_id)
+-----------------------+

+------------------+        +---------------------------+
|    menu_items    |<-------|   menu_item_type_groups   |
|------------------|        |---------------------------|
| id (PK)          |        | id (PK)                   |
| item_key (UQ)    |        | menu_item_id (FK)         |
| item_name (UQ)   |        | menu_type_id (FK)         |
| tray_price_*     |        | menu_group_id (FK)        |
| is_active        |        | is_active                 |
+------------------+        | UQ(menu_item_id,menu_type_id)
                            +---------------------------+

+-----------------------+
| menu_group_conflicts  |
|-----------------------|
| id (PK)               |
| group_a_id (FK)       |
| group_b_id (FK)       |
| UQ(group_a_id,group_b_id)
| CHECK(group_a_id < group_b_id)
+-----------------------+

SERVICE PACKAGES

+----------------------------+      +-------------------+
|   service_plan_sections    |----->|   service_plans   |
|----------------------------|      |-------------------|
| id (PK)                    |      | id (PK)           |
| catalog_key                |      | section_id (FK)   |
| section_key (UQ)           |      | plan_key (UQ)     |
| section_type               |      | title             |
| public_section_id (UQ)     |      | price_*           |
| title                      |      | selection_mode    |
| note                       |      | sort_order        |
| sort_order                 |      | is_active         |
| is_active                  |      +-------------------+
+----------------------------+               |
                                             |
                 +---------------------------+-----------------------------+
                 |                           |                             |
                 v                           v                             v
     +---------------------------+  +----------------------+  +------------------------------+
     | service_plan_constraints  |  | service_plan_details |  | service_plan_selection_groups|
     |---------------------------|  |----------------------|  |------------------------------|
     | service_plan_id (FK)      |  | service_plan_id (FK) |  | service_plan_id (FK)         |
     | selection_key             |  | detail_text          |  | group_key                    |
     | min_select                |  | sort_order           |  | source_type                  |
     | max_select                |  +----------------------+  | menu_group_key               |
     +---------------------------+                            | min_select / max_select      |
                                                              +------------------------------+
                                                                                 |
                                                                                 v
                                                              +-------------------------------+
                                                              | service_plan_selection_options|
                                                              |-------------------------------|
                                                              | selection_group_id (FK)       |
                                                              | option_key                    |
                                                              | option_label                  |
                                                              | menu_item_id (nullable FK)    |
                                                              +-------------------------------+
```

What each area does

- `menu_items`
  - Canonical item identity and tray pricing.
  - No duplicate dish rows are needed just because an item appears in more than one catalog.
- `menu_types`
  - Type dimension for menu items.
  - Current runtime types are `regular` and `formal`.
- `menu_groups`
  - Menu-item grouping dimension.
  - Current keys include `entree`, `signature_protein`, `side`, `salad`, `passed_appetizer`, and `starter`.
- `menu_type_groups`
  - Declares which menu groups are valid for each menu type and the display order used by admin/public menus.
- `menu_item_type_groups`
  - Canonical item-to-type assignment table, one group per item per type.
  - This is what allows a dish to be regular, formal, or both without cloning `menu_items` rows.
- `menu_group_conflicts`
  - Shared rule table for conflicting menu groups, currently used by the inquiry/service validation layer.

- `service_plan_sections`
  - Fixed package buckets inside the two runtime catalogs: `catering` and `formal`.
  - These are not currently user-managed sections.
- `service_plans`
  - Canonical package rows.
  - This is the single package model for both catering packages and formal packages.
  - `is_active` is the only live package status.
- `service_plan_constraints`
  - Machine-readable customer-choice requirements for menu-backed package selections.
  - Example: `entree_signature_protein 1-2`, `sides_salads 2-3`.
- `service_plan_details`
  - Fixed included-item bullets.
  - Example: `Bread`, `Tortillas`, `Toppings`.
- `service_plan_selection_groups`
  - Customer-choice groups for custom or hybrid packages.
  - Example: `Taco Bar Proteins`.
- `service_plan_selection_options`
  - Options inside a custom customer-choice group.
  - Example: `Carne Asada`, `Chicken`, `Marinated Pork`.

Important current behavior

- `/api/menu/general/*` and `/api/menu/formal/*` are served from the unified menu-item tables.
- `/api/menus` is the composed public payload. It merges menu items with service-package data.
- Catering packages no longer use a separate "tier" persistence model. Buffet offerings are stored as packages like everything else.
- Formal course-option lists still render as grouped option blocks in the public payload, so some formal display helpers still carry `tiers`/`tier_title` as presentation data only.
- The admin package surface is `/admin/service-packages`, backed by `/api/admin/service-plans`.

Migration notes

- `api/sql/migrations/20260222_menu_unified_item_model.sql`
  - Canonical menu item model and backfill from the older split item structure.
- `api/sql/migrations/20260316_catering_packages_refactor.sql`
  - Canonical service-package tables and seed state.
- `api/sql/migrations/20260316_service_package_status_phase2.sql`
  - Drops the older extra package visibility flags so `is_active` is the only package status.
- `api/sql/migrations/20260316_service_package_constraint_families.sql`
  - Normalizes package constraint families such as `sides_salads`.
- `api/sql/migrations/20260316_service_package_specific_menu_groups.sql`
  - Adds the more specific catering choice families.
- `api/sql/migrations/20260316_service_package_drop_descriptions.sql`
  - Removes old `description` columns from the service-package model.

Maintenance task:

```powershell
cd api
python scripts/menu_admin_sync.py --apply-schema --reset
```

Admin sync endpoint example:

```http
POST /api/admin/menu/sync
X-Menu-Admin-Token: <MENU_ADMIN_TOKEN>
Content-Type: application/json

{
  "apply_schema": true,
  "reset": true,
  "seed": true
}
```

## Updating Landing Photos

Media metadata is database-first:
- `GET /api/slides` and `GET /api/gallery` both read labels/text from MySQL `slides`.
- Filenames are treated as storage details only and should not be used as display labels.

Current canonical media storage:
- files: `api/flask_api/static/slides`
- metadata: `slides` table (`title`, `caption`, `alt_text`, `image_url`, `media_type`, `is_slide`, `display_order`, `is_active`)

Step-by-step (current setup):
1. Add files to `api/flask_api/static/slides`.
2. Sync/normalize DB metadata (adds missing rows and writes placeholders for missing labels/text):

```powershell
cd api
python scripts/sync_gallery_media.py
```

3. Replace placeholder metadata with owner-provided values in `slides`:
   - `title` (label shown in gallery/modal)
   - `caption` (description text)
   - `alt_text` (accessibility text)
   - `is_slide` (`1` to include on landing carousel, `0` to keep only in gallery)
4. Disable retired media with `is_active = 0` instead of deleting rows.
5. Verify in browser:
   - `GET /api/gallery` returns expected labels/text and ordering
   - `GET /api/slides` returns only rows where `is_slide = 1`
   - Landing carousel and `/showcase` reflect metadata updates

Example SQL update:

```sql
UPDATE slides
SET
  title = 'Community Dinner',
  caption = 'Seasonal menu highlights',
  image_url = '/api/assets/slides/community-dinner-2026.jpg',
  alt_text = 'Community dinner service line',
  display_order = 1,
  is_active = 1
WHERE id = 1;
```

Future-ready option (recommended when moving off-repo assets):
1. Upload images to object storage/CDN (S3, R2, etc.).
2. Save full CDN URLs in `slides.image_url` (no frontend code changes required).
3. Use versioned filenames or query params for cache busting (example: `hero-2026-05.jpg?v=2`).
4. Keep `GET /api/slides` as the single source of truth so updates remain operational, not code-driven.

## Inquiry Flow

Frontend:
- Loads menu config from `/api/menus`
- Builds service package selections dynamically, including menu-backed and custom customer-choice groups
- Posts inquiry payload to `/api/inquiries`

Current frontend UX notes:
- Shared form-control styling for public/admin modals now lives in `client/src/App.css` via common form tokens, so broad form visual updates can be made centrally.
- The inquiry modal uses grouped key fields, required badges, and a currency-style budget input for clearer scanning.

Backend:
- Validates required fields and service selection rules
- Enforces event date at least 7 days out
- Validates US phone format
- Applies anti-abuse controls (rate limiting, duplicate suppression, message heuristics, domain checks)
- Stores inquiry in `inquiries` table
- Attempts owner notification + customer confirmation emails and records owner-email status

<!--
## Troubleshooting

- `Menu unavailable` in UI:
  - Check backend is running.
  - Confirm DB connection variables.
  - Run menu seed/sync task.

- Inquiry saved but no email sent:
  - Verify SMTP environment variables.
  - Confirm SMTP provider/app-password settings.

- CORS issues in local dev:
  - Ensure `CORS_ALLOW_ORIGIN` matches frontend URL.
-->

## Known Gaps

### Stretch goals
- Deferred (Production Readiness): Adopt Flask app-factory + blueprint structure for clearer initialization and easier testing.
- Migrate inquiry email transport from SMTP to Mailgun HTTP API for richer delivery telemetry, event/webhook handling, and provider-specific controls.
- Add production file-based logging (for example `api/logs/app.log`) alongside console logging for persistent operational/audit troubleshooting.
- Implement Docker containers for backend, frontend, and MySQL (with a `docker-compose` workflow for local and deployment parity).

## Program And Menu Reference

This README is no longer the source of truth for live pricing or package/menu inventory. Runtime offerings are DB-backed and admin-editable, so static snapshots drift quickly.

Use these sources instead:
- Public runtime payload: `GET /api/menus`
- Menu item maintenance: `/admin/menu-items`
- Service package maintenance: `/admin/service-packages`
- Seed/fallback baseline: `api/sql/menu_seed_payload.json`
- Package model notes: `docs/admin-service-packages.md`

## American Legion Post 468

### Catering And Community Food Programs

American Legion Post 468 Catering brings together professional culinary experience, large-scale event execution, and community mission alignment.

Leadership background includes fine dining, banquets, bartending, kitchen operations, banquet captain roles, and event coordination. The team operates from a commercial kitchen with volunteer support and can scale from small gatherings to large events.

Most importantly, each catered event supports veteran outreach in Julian and surrounding areas.

### Monday Meal Program (Community Impact)

The Monday Meal Program was created to support local veterans with reliable meals, especially for people facing mobility, fixed-income, or service-access challenges. Catering operations help sustain this effort.
