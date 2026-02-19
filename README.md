# American Legion Post 468 Catering Application

Web application for American Legion Post 468 catering services and community food programs.  
This repository includes a React frontend, a Flask backend, and a MySQL data layer for menus, inquiries, and homepage slides.

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
- Data model: normalized relational menu tables served by `/api/menus`

## Repository Layout

```text
PostCatering/
  api/
    server.py
    .env.example
    flask_api/
      controllers/
      services/
      models/
      validators/
      config/
    sql/
      schema.sql
      menu_seed_payload.json
      menu_seed.sql
    scripts/
      menu_admin_sync.py
  client/
    src/
    public/
    package.json
  README.md
```

## Local Development Setup

### Prerequisites

- Node.js 20+ and npm
- Python 3.10+ (3.11 recommended)
- MySQL 8+ (or compatible)

### 1) Backend Setup (`api/`)

```powershell
cd api
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install flask pymysql python-dotenv
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

## Environment Variables

Use `api/.env.example` as the source of truth for variable names.

- `FLASK_APP`: Flask entry point (`server.py`)
- `FLASK_ENV`: environment (`development` for local)
- `FLASK_SECRET_KEY`: Flask session/secret key
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

## API Overview

- `GET /api/health`  
  Health check including DB connectivity.

- `GET /api/slides`  
  Returns active homepage slides.

- `GET /api/assets/slides/<filename>`  
  Serves slide assets from backend static storage.

- `GET /api/menus`  
  Returns menu payload consumed by the frontend.

- `POST /api/inquiries`  
  Validates and stores inquiry submissions; attempts SMTP notification.

- `POST /api/admin/menu/sync`  
  Protected endpoint for schema apply/reset/seed operations. Requires `MENU_ADMIN_TOKEN` in header.

## API Naming Conventions

- HTTP payloads use `snake_case` for API field names.
- React component/view-model state uses `camelCase`.
- Boundary mapping is enforced in `client/src/hooks/useMenuConfig.js` for `/api/menus`:
  - API fields like `page_title`, `intro_blocks`, `section_id`, `course_type`, `include_keys`, `tier_title`
  - Client fields like `pageTitle`, `introBlocks`, `sectionId`, `courseType`, `includeKeys`, `tierTitle`
- Inquiry request/response payloads remain `snake_case` end-to-end to align with backend validators and DB fields.

## Menu Data And Maintenance

Primary menu source is normalized MySQL tables. Seed source is:
- `api/sql/menu_seed_payload.json`

Maintenance details and SQL examples:
- `api/flask_api/config/MENU_DB_MAINTENANCE.md`

Key maintenance rule:
- Use `is_active = 0` to hide rows instead of deleting data.

CLI maintenance task:

```powershell
cd api
python scripts/menu_admin_sync.py --apply-schema --reset
```

Admin endpoint example:

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

## Updating Homepage Photos

Current canonical location:
- `api/flask_api/static/slides`
- Frontend loads slide metadata from `GET /api/slides` and renders each slide `src` as returned.

Step-by-step (current setup):
1. Prepare each image (recommended landscape ratio, web-compressed JPG/WEBP).
2. Add new files to `api/flask_api/static/slides` with stable, descriptive filenames.
3. Update slide records in MySQL `slides` table:
   - `image_url` should point to `/api/assets/slides/<filename>`
   - Set `title`, `caption`, `alt_text`, `display_order`, and `is_active`
4. Disable retired slides with `is_active = 0` (instead of deleting rows) to preserve history.
5. Verify in browser:
   - `GET /api/slides` returns expected order and URLs
   - Homepage carousel shows updated images/text
6. Commit image file changes (if files are in repo) and any migration/SQL changes used to update records.

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
- Builds service/package/tier selections dynamically
- Posts inquiry payload to `/api/inquiries`

Backend:
- Validates required fields and service selection rules
- Enforces event date at least 7 days out
- Validates US phone format
- Applies anti-abuse controls (rate limiting, duplicate suppression, message heuristics, domain checks)
- Stores inquiry in `inquiries` table
- Attempts SMTP email and records email status

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

### To-do list:
#### Architecture
- ~~Break up oversized components (`client/src/components/Inquiry.jsx`, `client/src/components/ServiceMenu.jsx`) into smaller hooks/components.~~
- ~~Consolidate duplicated service-selection rules/constraints so frontend and backend use one source of truth.~~
- ~~Decide whether inquiry is modal-only or route-only; current setup mounts `Inquiry` in `Wrapper` and also at `/inquiry`.~~
#### Performance
- ~~Avoid duplicate `/api/menus` fetches by centralizing menu config state/caching.~~
#### Frontend Cleanup
- ~~Remove stray `git` token in `client/src/App.jsx`.~~
- ~~Fix current lint violations and keep lint clean (`Footer` unused imports, unused `subtitle` prop, unused bootstrap import, effect setState warning).~~
- ~~Remove archive/dead file `client/src/static/menuData.jsx` (or move it to docs/reference only).~~
- ~~Remove or implement the currently empty `Footer` component.~~
- ~~Deduplicate Bootstrap imports (`main.jsx` + `App.jsx`) and remove unused `import * as bootstrap`.~~
- ~~Remove stale commented boilerplate/imports that no longer add value.~~
- ~~Replace heuristic text cleanup (e.g., Entree regex normalization) with clean UTF-8 source data.~~

#### Frontend Assets
- ~~Remove duplicated/unused slide images in `client/public/imgs` if backend slide assets are canonical.~~

#### Backend Standards
- ~~Add a tracked backend dependency manifest (`api/requirements.txt` or `api/pyproject.toml`) with pinned versions.~~
- Deferred (Production Readiness): Adopt Flask app-factory + blueprint structure for clearer initialization and easier testing.
- ~~Use safer defaults (`FLASK_DEBUG=false`, restrictive CORS defaults) for production readiness.~~
- ~~Include `X-Menu-Admin-Token` in CORS allowed headers for browser-based admin calls.~~ (Superseded by dedicated admin dashboard stretch goal.)

#### Backend Logic
- ~~Persist inquiry selections as structured data (JSON columns or related tables) instead of appending everything into `message`.~~
- ~~Strengthen server-side validation and normalization for email/phone/budget fields.~~
- ~~Add abuse controls for `/api/inquiries` (rate limiting/spam protection, optional CAPTCHA).~~
- ~~Add structured logging and clearer SMTP failure diagnostics (without exposing secrets).~~

#### Data Model
- ~~Reassess menu-table normalization depth; consider a hybrid model to reduce complexity and query assembly cost.~~
- ~~Resolve the unused `menu_config` path (remove dead table/path or make it an intentional cached canonical representation).~~
- ~~Normalize price storage for machine use (numeric fields + currency) instead of mostly formatted text strings.~~
- ~~Make constraint storage consistent (`formal_plan_option_constraints` vs suffix-based tier constraint keys).~~

#### Data Access
- ~~Refactor DB access to avoid opening a new connection per query; support transaction/connection reuse per request.~~
- ~~Optimize `Menu.seed_from_payload` to reduce N+1 lookups and batch writes.~~
- ~~Expand health checks to verify DB connectivity, not just process status.~~

#### Testing
- Add backend unit/integration tests and frontend component/form tests.

#### Tooling
- Add CI checks for lint/test/build to prevent regressions.
- Add pre-commit formatting/lint hooks (e.g., `ruff`/`black` for Python plus ESLint).

#### Docs
- Reconcile outdated docs/comments (e.g., `api/sql/menu_seed.sql` still references auto-seed behavior).
- ~~Define and enforce API naming conventions at boundaries (snake_case vs camelCase).~~

#### Stretch Goals
- Build a dedicated admin dashboard for menu/slide operations with authenticated admin access (instead of browser calls with a static token).

## Program And Menu Reference (Current Data)

This section preserves the current business/program content and pricing snapshot for maintainers.

## American Legion Post 468

### Catering And Community Food Programs

American Legion Post 468 Catering brings together professional culinary experience, large-scale event execution, and community mission alignment.

Leadership background includes fine dining, banquets, bartending, kitchen operations, banquet captain roles, and event coordination. The team operates from a commercial kitchen with volunteer support and can scale from small gatherings to large events.

Most importantly, each catered event supports veteran outreach in Julian and surrounding areas.

### Monday Meal Program (Community Impact)

The Monday Meal Program was created to support local veterans with reliable meals, especially for people facing mobility, fixed-income, or service-access challenges. Catering operations help sustain this effort.

### To-Go And Take-And-Bake Trays

Served hot or chilled to reheat.

Tray sizes:
- Half tray: serves 8-10
- Full tray: serves 16-20

#### Baked And Hearty Entree Trays

| Entree | Half Tray | Full Tray |
| --- | --- | --- |
| Lasagna (Meat or Veg) | $75 | $135 |
| Enchiladas (Cheese or Chicken, Red or Green) | $70 | $130 |
| Baked Ziti (Veg or Beef) | $65 | $120 |
| BBQ Pulled Pork | $75 | $140 |
| Shepherd's Pie | $80 | $150 |
| Beef Stroganoff | $85 | $160 |
| Beef & Pancetta Bolognese Pappardelle | $90 | $170 |

#### Signature Protein Trays

| Entree | Half Tray | Full Tray |
| --- | --- | --- |
| Bone-In Herb Roasted Chicken Thighs | $75 | $140 |
| Apple Cider-Marinated Pork Chops | $85 | $160 |
| Marinated Pork Stir-Fry | $80 | $150 |
| Stuffed Chicken Breast (Spinach, Mushroom, Cheese) | $90 | $170 |
| Herb-Marinated Tri-Tip w/ Chimichurri | $110 | $210 |
| Braised Short Ribs | $120 | $225 |

#### Sides And Salads

| Side | Half | Full |
| --- | --- | --- |
| Garlic Mashed Potatoes | $40 | $75 |
| Herb Roasted Fingerlings | $40 | $75 |
| Rice Pilaf | $35 | $65 |
| Mac & Cheese | $45 | $85 |
| Pasta Salad (Creamy or Pesto) | $35 | $65 |
| Coleslaw | $30 | $55 |
| Roasted Seasonal Vegetables | $40 | $75 |
| Caesar Salad | $35 | $65 |
| Watermelon & Feta Salad | $40 | $75 |
| Beet & Citrus Salad | $40 | $75 |
| Cucumber Tomato Salad | $35 | $65 |
| Caprese Salad | $45 | $85 |
| Au Gratin Potatoes | $45 | $85 |
| Strawberry Arugula Salad | $40 | $75 |
| Garlic Bread / Rolls / Cornbread | $25 | $45 |
| Fried Rice | $45 | $85 |
| Lumpia | $55 | $100 |
| Charcuterie Board (Serves 10-12) | - | $95 |

### Community And Crew Catering (Per Person)

Drop-off or buffet setup. Minimums apply.

#### Taco Bar (Carne Asada or Chicken)

Includes Spanish rice, refried beans, tortillas, toppings.  
$18-$25 per person

#### Hearty Homestyle Packages

Choose:
- 1 protein or entree
- 2 sides
- bread

$20-$28 per person

#### Event Catering - Buffet Style

Tier 1: Casual Buffet ($30-$40 per person)
- 2 entrees
- 2 sides
- 1 salad
- bread

Tier 2: Elevated Buffet / Family-Style ($45-$65 per person)
- 2-3 entrees
- 3 sides
- 2 salads
- bread

### Formal Events - Plated And Full Service

#### Three-Course Dinner

$75-$110+ per person

Choose:
- 2 passed appetizers
- 1 starter
- 1 or 2 entrees
- bread

Passed appetizers (choose two):
- Bruschetta
- Caprese Crostini
- Prosciutto & Brie Bites
- Sirloin Sliders

Starter (choose one):
- Caesar
- Beet & Citrus Salad
- Caprese
- Strawberry Arugula Salad

Entree (choose one or two):
- Braised Short Rib
- Apple Cider-Marinated Pork Chop
- Herb-Marinated Tri-Tip
- Spinach and Mushroom Stuffed Chicken Breast
- Mushroom Risotto (Vegetarian)

Sides:
- Garlic Mashed Potatoes or Au Gratin
- Seasonal Vegetables
- Rice Pilaf
