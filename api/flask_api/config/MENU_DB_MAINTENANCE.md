# Menu DB Maintenance (Unified Model)

Last updated: February 22, 2026

## Scope

This document covers menu data maintenance for the unified menu schema:
- one canonical `menu_items` table for item identity/pricing
- type reference in `menu_types`
- group reference in `menu_groups`
- allowed type/group pairs in `menu_type_groups`
- per-item assignments in `menu_item_type_groups`
- optional conflict rules in `menu_group_conflicts`

## Core Tables

- `menu_types`
  - singular unique keys such as `regular`, `formal`
- `menu_groups`
  - singular unique keys such as `entree`, `side`, `salad`, `starter`
- `menu_type_groups`
  - valid group list for each type and display ordering
- `menu_items`
  - canonical item row (`item_key`, `item_name`, `tray_price_half`, `tray_price_full`, `is_active`)
- `menu_item_type_groups`
  - one assignment per `(menu_item_id, menu_type_id)` to a `menu_group_id`
- `menu_group_conflicts`
  - disallowed cross-type group pair constraints

## Operational Commands

Apply schema + migration + reseed from payload:

```powershell
cd api
python scripts/menu_admin_sync.py --apply-schema --reset
```

Seed only (no schema apply):

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

## Assignment Rules

- One menu item can be assigned to `regular`, `formal`, or both.
- Group is assigned per type via `menu_item_type_groups`.
- Use `menu_group_conflicts` to block disallowed cross-type pairings.
- Use `is_active = 0` to retire rows instead of deleting when possible.

## Quick Validation Queries

Check type/group reference rows:

```sql
SELECT type_key, type_name, sort_order, is_active
FROM menu_types
ORDER BY sort_order, id;

SELECT group_key, group_name, sort_order, is_active
FROM menu_groups
ORDER BY sort_order, id;
```

Check per-type assignments:

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

Check potential conflict violations:

```sql
SELECT
  i.id,
  i.item_name,
  ta.type_key AS type_a,
  ga.group_key AS group_a,
  tb.type_key AS type_b,
  gb.group_key AS group_b
FROM menu_item_type_groups a
JOIN menu_item_type_groups b
  ON b.menu_item_id = a.menu_item_id
 AND b.menu_type_id > a.menu_type_id
JOIN menu_items i ON i.id = a.menu_item_id
JOIN menu_types ta ON ta.id = a.menu_type_id
JOIN menu_groups ga ON ga.id = a.menu_group_id
JOIN menu_types tb ON tb.id = b.menu_type_id
JOIN menu_groups gb ON gb.id = b.menu_group_id
JOIN menu_group_conflicts c
  ON c.group_a_id = LEAST(a.menu_group_id, b.menu_group_id)
 AND c.group_b_id = GREATEST(a.menu_group_id, b.menu_group_id)
ORDER BY i.item_name;
```
