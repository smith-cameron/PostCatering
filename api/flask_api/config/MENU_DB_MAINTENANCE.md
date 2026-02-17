# Menu DB Maintenance

This project now serves `/api/menus` from normalized relational tables.

## Key Rule

Use `is_active = 0` to hide content instead of deleting rows. The API only returns active rows, so frontend updates are not required.

## One-time Initialization

If the menu tables are empty, the API auto-seeds from `api/sql/menu_seed_payload.json` the first time `/api/menus` is requested.

## Common Operations

### 1) Add a new reusable menu item

```sql
INSERT INTO menu_items (item_key, item_name, is_active)
VALUES ('new_item_key', 'New Item Display Name', 1)
ON DUPLICATE KEY UPDATE
  item_name = VALUES(item_name),
  is_active = 1,
  updated_at = CURRENT_TIMESTAMP;
```

### 2) Add item to an option group (for MENU_OPTIONS and includeMenu sections)

```sql
INSERT INTO menu_option_group_items (group_id, item_id, display_order, is_active)
SELECT g.id, i.id, 99, 1
FROM menu_option_groups g
JOIN menu_items i ON i.item_key = 'new_item_key'
WHERE g.option_key = 'sidesSalads'
ON DUPLICATE KEY UPDATE
  display_order = VALUES(display_order),
  is_active = 1,
  updated_at = CURRENT_TIMESTAMP;
```

### 3) Add item pricing row to a To-Go section

```sql
INSERT INTO menu_section_rows (section_id, item_id, value_1, value_2, display_order, is_active)
SELECT s.id, i.id, '$45', '$85', 99, 1
FROM menu_sections s
JOIN menu_items i ON i.item_key = 'new_item_key'
WHERE s.section_key = 'togo_sides_salads'
ON DUPLICATE KEY UPDATE
  value_1 = VALUES(value_1),
  value_2 = VALUES(value_2),
  display_order = VALUES(display_order),
  is_active = 1,
  updated_at = CURRENT_TIMESTAMP;
```

### 4) Turn off (hide) one menu item everywhere

```sql
UPDATE menu_items
SET is_active = 0, updated_at = CURRENT_TIMESTAMP
WHERE item_key = 'new_item_key';
```

This removes it from:
- `MENU_OPTIONS` lists
- table `rows` in To-Go sections
- tier `bullets` when the bullet is item-backed (formal menu items are item-backed)

### 5) Turn off one item only in a specific option group

```sql
UPDATE menu_option_group_items gi
JOIN menu_option_groups g ON g.id = gi.group_id
JOIN menu_items i ON i.id = gi.item_id
SET gi.is_active = 0, gi.updated_at = CURRENT_TIMESTAMP
WHERE g.option_key = 'sidesSalads'
  AND i.item_key = 'new_item_key';
```

### 6) Turn off one item only in one priced section

```sql
UPDATE menu_section_rows r
JOIN menu_sections s ON s.id = r.section_id
JOIN menu_items i ON i.id = r.item_id
SET r.is_active = 0, r.updated_at = CURRENT_TIMESTAMP
WHERE s.section_key = 'togo_sides_salads'
  AND i.item_key = 'new_item_key';
```

### 7) Turn off an entire section

```sql
UPDATE menu_sections
SET is_active = 0, updated_at = CURRENT_TIMESTAMP
WHERE section_key = 'community_homestyle';
```

### 8) Re-enable any row

Set `is_active = 1` on the same table/row you disabled.

## Reference Tables

- `menu_items`
- `menu_option_groups`
- `menu_option_group_items`
- `formal_plan_options`
- `formal_plan_option_details`
- `formal_plan_option_constraints`
- `menu_catalogs`
- `menu_intro_blocks`
- `menu_intro_bullets`
- `menu_sections`
- `menu_section_columns`
- `menu_section_rows`
- `menu_section_include_groups`
- `menu_section_tiers`
- `menu_section_tier_constraints`
- `menu_section_tier_bullets`
