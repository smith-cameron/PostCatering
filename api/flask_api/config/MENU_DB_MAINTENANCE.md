# Menu DB Maintenance (Unified Menu + Service Package Model)

Last updated: March 22, 2026

## Scope

This document covers the current normalized MySQL schema used by:
- unified menu-item maintenance
- service-package maintenance
- public `/api/menus` composition
- inquiry validation that depends on menu and package rules

Schema sync source of truth:
- `api/sql/schema.sql`
- ordered migrations in `api/sql/migrations`
- `api/scripts/menu_admin_sync.py`

## Core Tables

Menu domain:
- `menu_types`
  - canonical runtime types such as `regular` and `formal`
- `menu_groups`
  - canonical group keys such as `entree`, `signature_protein`, `side`, `salad`, `passed_appetizer`, `starter`
- `menu_type_groups`
  - allowed type/group pairs plus display order per menu type
- `menu_items`
  - canonical item identity and tray-pricing rows
- `menu_item_type_groups`
  - one item-to-group assignment per `(menu_item_id, menu_type_id)`
- `menu_group_conflicts`
  - optional disallowed cross-group pair rules used by validation

Service-package domain:
- `service_plan_sections`
  - fixed section definitions inside runtime catalogs `catering` and `formal`
  - current seeded sections include `catering_packages`, `catering_menu_options`, and `formal_packages`
- `service_section_menu_groups`
  - menu families exposed by an `include_menu` section in the public payload
- `service_plans`
  - canonical package rows
  - `selection_mode` is derived as `menu_groups`, `custom_options`, `hybrid`, or `none`
- `service_plan_constraints`
  - menu-backed customer-choice limits
- `service_plan_details`
  - fixed included-item bullets
- `service_plan_selection_groups`
  - custom or hybrid customer-choice group definitions
- `service_plan_selection_options`
  - options inside a custom customer-choice group

## Operational Commands

Apply schema + ordered migrations + reseed from payload:

```powershell
cd api
python scripts/menu_admin_sync.py --apply-schema --reset
```

Apply schema only (no reseed):

```powershell
cd api
python scripts/menu_admin_sync.py --apply-schema --no-seed
```

Reseed simplified menu tables only:

```powershell
cd api
python scripts/menu_admin_sync.py --reset
```

API equivalent:

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

## Maintenance Rules

- One menu item can be assigned to `regular`, `formal`, or both.
- Group is assigned per type via `menu_item_type_groups`.
- Use `menu_group_conflicts` to block disallowed cross-type pairings.
- Service-package sections are fixed operational buckets; the current admin UI manages plans inside package sections, not section definitions.
- `include_menu` sections expose `includeKeys` from `service_section_menu_groups`.
- Use `is_active = 0` to retire menu items, plans, and sections instead of deleting rows when possible.

## Quick Validation Queries

Check menu type/group reference rows:

```sql
SELECT type_key, type_name, sort_order, is_active
FROM menu_types
ORDER BY sort_order, id;

SELECT group_key, group_name, sort_order, is_active
FROM menu_groups
ORDER BY sort_order, id;
```

Check per-type item assignments:

```sql
SELECT
  i.item_name,
  t.type_key,
  g.group_key,
  i.is_active,
  mitg.is_active AS assignment_is_active
FROM menu_item_type_groups mitg
JOIN menu_items i ON i.id = mitg.menu_item_id
JOIN menu_types t ON t.id = mitg.menu_type_id
JOIN menu_groups g ON g.id = mitg.menu_group_id
ORDER BY i.item_name, t.sort_order;
```

Check service-package sections and plan counts:

```sql
SELECT
  s.catalog_key,
  s.section_key,
  s.section_type,
  s.is_active AS section_is_active,
  COUNT(p.id) AS plan_count,
  SUM(CASE WHEN p.is_active = 1 THEN 1 ELSE 0 END) AS active_plan_count
FROM service_plan_sections s
LEFT JOIN service_plans p ON p.section_id = s.id
GROUP BY s.id, s.catalog_key, s.section_key, s.section_type, s.is_active
ORDER BY s.catalog_key, s.sort_order;
```

Check `include_menu` section mappings:

```sql
SELECT
  s.catalog_key,
  s.section_key,
  g.menu_group_key,
  g.sort_order
FROM service_section_menu_groups g
JOIN service_plan_sections s ON s.id = g.section_id
ORDER BY s.catalog_key, s.sort_order, g.sort_order, g.id;
```

Service-package behavior and admin/public payload notes live in `docs/admin-service-packages.md`.
