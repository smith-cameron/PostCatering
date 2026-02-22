USE post_catering;

START TRANSACTION;

/* -------------------------------------------------------------------------- */
/* Legacy placeholders for idempotent reruns                                   */
/* -------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS general_menu_groups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  `key` VARCHAR(120) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_general_menu_groups_name (`name`),
  UNIQUE KEY uq_general_menu_groups_key (`key`)
);

CREATE TABLE IF NOT EXISTS formal_menu_groups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  `key` VARCHAR(120) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_formal_menu_groups_name (`name`),
  UNIQUE KEY uq_formal_menu_groups_key (`key`)
);

CREATE TABLE IF NOT EXISTS general_menu_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  `key` VARCHAR(128) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  group_id BIGINT UNSIGNED NOT NULL,
  half_tray_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  full_tray_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_general_menu_items_key (`key`),
  KEY idx_general_menu_items_group_id (group_id),
  CONSTRAINT fk_general_menu_items_group FOREIGN KEY (group_id) REFERENCES general_menu_groups(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS formal_menu_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  `key` VARCHAR(128) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  group_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_formal_menu_items_key (`key`),
  KEY idx_formal_menu_items_group_id (group_id),
  CONSTRAINT fk_formal_menu_items_group FOREIGN KEY (group_id) REFERENCES formal_menu_groups(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS menu_item_types (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  menu_item_id BIGINT UNSIGNED NOT NULL,
  menu_type_id BIGINT UNSIGNED NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_menu_item_type_pair (menu_item_id, menu_type_id)
);

/* -------------------------------------------------------------------------- */
/* Canonical hybrid schema                                                     */
/* -------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS menu_types (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  type_key VARCHAR(64) NOT NULL,
  type_name VARCHAR(120) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_menu_types_key (type_key),
  UNIQUE KEY uq_menu_types_name (type_name),
  KEY idx_menu_types_active_order (is_active, sort_order)
);

CREATE TABLE IF NOT EXISTS menu_groups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  group_key VARCHAR(120) NOT NULL,
  group_name VARCHAR(120) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_menu_groups_key (group_key),
  UNIQUE KEY uq_menu_groups_name (group_name),
  KEY idx_menu_groups_active_order (is_active, sort_order)
);

CREATE TABLE IF NOT EXISTS menu_type_groups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  menu_type_id BIGINT UNSIGNED NOT NULL,
  menu_group_id BIGINT UNSIGNED NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_menu_type_group_pair (menu_type_id, menu_group_id),
  UNIQUE KEY uq_menu_type_group_order (menu_type_id, display_order),
  KEY idx_menu_type_groups_active (is_active),
  CONSTRAINT fk_menu_type_groups_type FOREIGN KEY (menu_type_id) REFERENCES menu_types(id) ON DELETE CASCADE,
  CONSTRAINT fk_menu_type_groups_group FOREIGN KEY (menu_group_id) REFERENCES menu_groups(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS menu_item_type_groups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  menu_item_id BIGINT UNSIGNED NOT NULL,
  menu_type_id BIGINT UNSIGNED NOT NULL,
  menu_group_id BIGINT UNSIGNED NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_menu_item_type_group_item_type (menu_item_id, menu_type_id),
  KEY idx_menu_item_type_groups_active (is_active),
  KEY idx_menu_item_type_groups_group_id (menu_group_id),
  CONSTRAINT fk_menu_item_type_groups_item FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_menu_item_type_groups_type FOREIGN KEY (menu_type_id) REFERENCES menu_types(id) ON DELETE CASCADE,
  CONSTRAINT fk_menu_item_type_groups_group FOREIGN KEY (menu_group_id) REFERENCES menu_groups(id) ON DELETE RESTRICT,
  CONSTRAINT fk_menu_item_type_groups_type_group FOREIGN KEY (menu_type_id, menu_group_id)
    REFERENCES menu_type_groups(menu_type_id, menu_group_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS menu_group_conflicts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  group_a_id BIGINT UNSIGNED NOT NULL,
  group_b_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_menu_group_conflicts_pair (group_a_id, group_b_id),
  CONSTRAINT chk_menu_group_conflicts_order CHECK (group_a_id < group_b_id),
  CONSTRAINT fk_menu_group_conflicts_a FOREIGN KEY (group_a_id) REFERENCES menu_groups(id) ON DELETE CASCADE,
  CONSTRAINT fk_menu_group_conflicts_b FOREIGN KEY (group_b_id) REFERENCES menu_groups(id) ON DELETE CASCADE
);

SET @menu_items_has_group_id_pre = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS c
  WHERE c.TABLE_SCHEMA = DATABASE()
    AND c.TABLE_NAME = 'menu_items'
    AND c.COLUMN_NAME = 'group_id'
);
SET @add_menu_items_group_col_sql = IF(
  @menu_items_has_group_id_pre = 0,
  'ALTER TABLE menu_items ADD COLUMN group_id BIGINT UNSIGNED NULL',
  'SELECT 1'
);
PREPARE add_menu_items_group_col_stmt FROM @add_menu_items_group_col_sql;
EXECUTE add_menu_items_group_col_stmt;
DEALLOCATE PREPARE add_menu_items_group_col_stmt;

INSERT INTO menu_types (type_key, type_name, sort_order, is_active)
VALUES
  ('regular', 'Regular', 1, 1),
  ('formal', 'Formal', 2, 1)
ON DUPLICATE KEY UPDATE
  type_name = VALUES(type_name),
  sort_order = VALUES(sort_order),
  is_active = VALUES(is_active),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO menu_groups (group_key, group_name, sort_order, is_active)
VALUES
  ('entree', 'Entree', 1, 1),
  ('signature_protein', 'Signature Protein', 2, 1),
  ('side', 'Side', 3, 1),
  ('salad', 'Salad', 4, 1),
  ('passed_appetizer', 'Passed Appetizer', 5, 1),
  ('starter', 'Starter', 6, 1)
ON DUPLICATE KEY UPDATE
  group_name = VALUES(group_name),
  sort_order = VALUES(sort_order),
  is_active = VALUES(is_active),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO menu_type_groups (menu_type_id, menu_group_id, display_order, is_active)
SELECT mt.id, mg.id, src.display_order, 1
FROM (
  SELECT 'regular' AS type_key, 'entree' AS group_key, 1 AS display_order
  UNION ALL SELECT 'regular', 'signature_protein', 2
  UNION ALL SELECT 'regular', 'side', 3
  UNION ALL SELECT 'regular', 'salad', 4
  UNION ALL SELECT 'formal', 'passed_appetizer', 1
  UNION ALL SELECT 'formal', 'starter', 2
  UNION ALL SELECT 'formal', 'entree', 3
  UNION ALL SELECT 'formal', 'side', 4
) src
JOIN menu_types mt ON mt.type_key = src.type_key
JOIN menu_groups mg ON mg.group_key = src.group_key
ON DUPLICATE KEY UPDATE
  display_order = VALUES(display_order),
  is_active = VALUES(is_active),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO menu_group_conflicts (group_a_id, group_b_id)
SELECT
  LEAST(gs.id, gd.id),
  GREATEST(gs.id, gd.id)
FROM menu_groups gs
JOIN menu_groups gd
  ON gs.group_key = 'side'
 AND gd.group_key = 'salad'
ON DUPLICATE KEY UPDATE
  group_a_id = VALUES(group_a_id),
  group_b_id = VALUES(group_b_id);

/* -------------------------------------------------------------------------- */
/* Backfill menu_items from legacy split tables                                */
/* -------------------------------------------------------------------------- */
INSERT INTO menu_items (item_key, item_name, tray_price_half, tray_price_full, is_active)
SELECT
  NULLIF(TRIM(src.item_key), ''),
  src.item_name,
  src.tray_price_half,
  src.tray_price_full,
  src.is_active
FROM (
  SELECT
    gi.`key` AS item_key,
    TRIM(gi.name) AS item_name,
    CAST(gi.half_tray_price AS CHAR(100)) AS tray_price_half,
    CAST(gi.full_tray_price AS CHAR(100)) AS tray_price_full,
    IF(gi.is_active = 1, 1, 0) AS is_active
  FROM general_menu_items gi
  WHERE TRIM(COALESCE(gi.name, '')) <> ''

  UNION ALL

  SELECT
    fi.`key` AS item_key,
    TRIM(fi.name) AS item_name,
    NULL AS tray_price_half,
    NULL AS tray_price_full,
    IF(fi.is_active = 1, 1, 0) AS is_active
  FROM formal_menu_items fi
  WHERE TRIM(COALESCE(fi.name, '')) <> ''
) src
ON DUPLICATE KEY UPDATE
  item_key = COALESCE(NULLIF(VALUES(item_key), ''), menu_items.item_key),
  tray_price_half = COALESCE(VALUES(tray_price_half), menu_items.tray_price_half),
  tray_price_full = COALESCE(VALUES(tray_price_full), menu_items.tray_price_full),
  is_active = IF(menu_items.is_active = 1 OR VALUES(is_active) = 1, 1, 0),
  updated_at = CURRENT_TIMESTAMP;

/* -------------------------------------------------------------------------- */
/* Backfill per-type group assignments from legacy menu_item_types             */
/* -------------------------------------------------------------------------- */
INSERT INTO menu_item_type_groups (menu_item_id, menu_type_id, menu_group_id, is_active)
SELECT
  mi.id,
  mt.id,
  COALESCE(tg_direct.menu_group_id, tg_fallback.menu_group_id),
  1
FROM menu_item_types mit
JOIN menu_items mi ON mi.id = mit.menu_item_id
JOIN menu_types mt ON mt.id = mit.menu_type_id
LEFT JOIN menu_groups mg_direct
  ON mg_direct.id = mi.group_id
LEFT JOIN menu_type_groups tg_direct
  ON tg_direct.menu_type_id = mt.id
 AND tg_direct.menu_group_id = mg_direct.id
LEFT JOIN menu_groups mg_fallback
  ON mg_fallback.group_key = CASE
    WHEN mt.type_key = 'regular' THEN
      CASE
        WHEN LOWER(TRIM(COALESCE(mi.item_category, ''))) IN ('signature_protein', 'signature_proteins')
          THEN 'signature_protein'
        WHEN LOWER(TRIM(COALESCE(mi.item_category, ''))) IN ('salad', 'salads')
          THEN 'salad'
        WHEN LOWER(TRIM(COALESCE(mi.item_category, ''))) IN ('side', 'sides', 'sides_salad', 'sides_salads')
          THEN 'side'
        ELSE 'entree'
      END
    ELSE
      CASE
        WHEN LOWER(TRIM(COALESCE(mi.item_category, ''))) IN ('passed_appetizer', 'passed_appetizers', 'passed')
          THEN 'passed_appetizer'
        WHEN LOWER(TRIM(COALESCE(mi.item_category, ''))) = 'starter'
          THEN 'starter'
        WHEN LOWER(TRIM(COALESCE(mi.item_category, ''))) IN ('side', 'sides', 'salad', 'salads')
          THEN 'side'
        ELSE 'entree'
      END
  END
LEFT JOIN menu_type_groups tg_fallback
  ON tg_fallback.menu_type_id = mt.id
 AND tg_fallback.menu_group_id = mg_fallback.id
WHERE COALESCE(tg_direct.menu_group_id, tg_fallback.menu_group_id) IS NOT NULL
ON DUPLICATE KEY UPDATE
  menu_group_id = COALESCE(VALUES(menu_group_id), menu_item_type_groups.menu_group_id),
  is_active = 1,
  updated_at = CURRENT_TIMESTAMP;

/* -------------------------------------------------------------------------- */
/* Backfill per-type group assignments from split tables                       */
/* -------------------------------------------------------------------------- */
INSERT INTO menu_item_type_groups (menu_item_id, menu_type_id, menu_group_id, is_active)
SELECT
  mi.id,
  mt.id,
  mg.id,
  1
FROM (
  SELECT
    TRIM(gi.name) AS item_name,
    'regular' AS type_key,
    CASE
      WHEN LOWER(gg.`key`) IN ('signature_protein', 'signature_proteins') THEN 'signature_protein'
      WHEN LOWER(gg.`key`) IN ('salad', 'salads') THEN 'salad'
      WHEN LOWER(gg.`key`) IN ('side', 'sides') THEN 'side'
      ELSE 'entree'
    END AS group_key
  FROM general_menu_items gi
  JOIN general_menu_groups gg ON gg.id = gi.group_id
  WHERE TRIM(COALESCE(gi.name, '')) <> ''

  UNION ALL

  SELECT
    TRIM(fi.name) AS item_name,
    'formal' AS type_key,
    CASE
      WHEN LOWER(fg.`key`) IN ('passed_appetizer', 'passed_appetizers') THEN 'passed_appetizer'
      WHEN LOWER(fg.`key`) = 'starter' THEN 'starter'
      WHEN LOWER(fg.`key`) IN ('side', 'sides', 'salad', 'salads') THEN 'side'
      ELSE 'entree'
    END AS group_key
  FROM formal_menu_items fi
  JOIN formal_menu_groups fg ON fg.id = fi.group_id
  WHERE TRIM(COALESCE(fi.name, '')) <> ''
) src
JOIN menu_items mi ON LOWER(TRIM(mi.item_name)) = LOWER(TRIM(src.item_name))
JOIN menu_types mt ON mt.type_key = src.type_key
JOIN menu_groups mg ON mg.group_key = src.group_key
JOIN menu_type_groups tg
  ON tg.menu_type_id = mt.id
 AND tg.menu_group_id = mg.id
ON DUPLICATE KEY UPDATE
  menu_group_id = VALUES(menu_group_id),
  is_active = 1,
  updated_at = CURRENT_TIMESTAMP;

/* -------------------------------------------------------------------------- */
/* Ensure every item has at least one typed assignment                         */
/* -------------------------------------------------------------------------- */
INSERT INTO menu_item_type_groups (menu_item_id, menu_type_id, menu_group_id, is_active)
SELECT
  mi.id,
  mt.id,
  mg.id,
  1
FROM menu_items mi
JOIN menu_types mt
  ON mt.type_key = CASE
    WHEN LOWER(TRIM(COALESCE(mi.item_category, ''))) IN ('passed_appetizer', 'passed_appetizers', 'starter')
      THEN 'formal'
    ELSE 'regular'
  END
JOIN menu_groups mg
  ON mg.group_key = CASE
    WHEN mt.type_key = 'regular' THEN
      CASE
        WHEN LOWER(TRIM(COALESCE(mi.item_category, ''))) IN ('signature_protein', 'signature_proteins')
          THEN 'signature_protein'
        WHEN LOWER(TRIM(COALESCE(mi.item_category, ''))) IN ('salad', 'salads')
          THEN 'salad'
        WHEN LOWER(TRIM(COALESCE(mi.item_category, ''))) IN ('side', 'sides', 'sides_salad', 'sides_salads')
          THEN 'side'
        ELSE 'entree'
      END
    ELSE
      CASE
        WHEN LOWER(TRIM(COALESCE(mi.item_category, ''))) IN ('passed_appetizer', 'passed_appetizers', 'passed')
          THEN 'passed_appetizer'
        WHEN LOWER(TRIM(COALESCE(mi.item_category, ''))) = 'starter'
          THEN 'starter'
        WHEN LOWER(TRIM(COALESCE(mi.item_category, ''))) IN ('side', 'sides', 'salad', 'salads')
          THEN 'side'
        ELSE 'entree'
      END
  END
JOIN menu_type_groups tg
  ON tg.menu_type_id = mt.id
 AND tg.menu_group_id = mg.id
LEFT JOIN menu_item_type_groups mitg
  ON mitg.menu_item_id = mi.id
 AND mitg.menu_type_id = mt.id
WHERE mitg.id IS NULL
ON DUPLICATE KEY UPDATE
  menu_group_id = VALUES(menu_group_id),
  is_active = 1,
  updated_at = CURRENT_TIMESTAMP;

/* -------------------------------------------------------------------------- */
/* Remove legacy menu_items.group_id (if present)                              */
/* -------------------------------------------------------------------------- */
SET @menu_items_group_fk = (
  SELECT kcu.CONSTRAINT_NAME
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
  WHERE kcu.TABLE_SCHEMA = DATABASE()
    AND kcu.TABLE_NAME = 'menu_items'
    AND kcu.COLUMN_NAME = 'group_id'
    AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
  LIMIT 1
);
SET @drop_menu_items_group_fk_sql = IF(
  @menu_items_group_fk IS NULL,
  'SELECT 1',
  CONCAT('ALTER TABLE menu_items DROP FOREIGN KEY `', @menu_items_group_fk, '`')
);
PREPARE drop_menu_items_group_fk_stmt FROM @drop_menu_items_group_fk_sql;
EXECUTE drop_menu_items_group_fk_stmt;
DEALLOCATE PREPARE drop_menu_items_group_fk_stmt;

SET @menu_items_group_idx = (
  SELECT s.INDEX_NAME
  FROM INFORMATION_SCHEMA.STATISTICS s
  WHERE s.TABLE_SCHEMA = DATABASE()
    AND s.TABLE_NAME = 'menu_items'
    AND s.COLUMN_NAME = 'group_id'
    AND s.INDEX_NAME <> 'PRIMARY'
  LIMIT 1
);
SET @drop_menu_items_group_idx_sql = IF(
  @menu_items_group_idx IS NULL,
  'SELECT 1',
  CONCAT('ALTER TABLE menu_items DROP INDEX `', @menu_items_group_idx, '`')
);
PREPARE drop_menu_items_group_idx_stmt FROM @drop_menu_items_group_idx_sql;
EXECUTE drop_menu_items_group_idx_stmt;
DEALLOCATE PREPARE drop_menu_items_group_idx_stmt;

SET @menu_items_has_group_id = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS c
  WHERE c.TABLE_SCHEMA = DATABASE()
    AND c.TABLE_NAME = 'menu_items'
    AND c.COLUMN_NAME = 'group_id'
);
SET @drop_menu_items_group_col_sql = IF(
  @menu_items_has_group_id = 0,
  'SELECT 1',
  'ALTER TABLE menu_items DROP COLUMN group_id'
);
PREPARE drop_menu_items_group_col_stmt FROM @drop_menu_items_group_col_sql;
EXECUTE drop_menu_items_group_col_stmt;
DEALLOCATE PREPARE drop_menu_items_group_col_stmt;

/* -------------------------------------------------------------------------- */
/* Remove stale split and transitional tables                                  */
/* -------------------------------------------------------------------------- */
DROP TABLE IF EXISTS general_menu_items;
DROP TABLE IF EXISTS formal_menu_items;
DROP TABLE IF EXISTS general_menu_groups;
DROP TABLE IF EXISTS formal_menu_groups;
DROP TABLE IF EXISTS menu_item_types;

COMMIT;
