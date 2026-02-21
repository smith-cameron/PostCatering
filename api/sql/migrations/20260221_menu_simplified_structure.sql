-- Menu refactor migration: introduce simplified general/formal menu tables
-- and backfill them from existing legacy menu tables.
--
-- IMPORTANT
-- - This script is idempotent for reruns.
-- - It does NOT drop or alter legacy menu tables.
-- - Review outputs at the bottom before COMMIT.
-- - Expected engine: MySQL 8+ (uses CTEs + REGEXP_REPLACE).

USE post_catering;

START TRANSACTION;

/* -------------------------------------------------------------------------- */
/* 1) Create simplified group tables                                           */
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
  UNIQUE KEY uq_general_menu_groups_name (name),
  UNIQUE KEY uq_general_menu_groups_key (`key`),
  KEY idx_general_menu_groups_active_order (is_active, sort_order)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS formal_menu_groups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  `key` VARCHAR(120) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_formal_menu_groups_name (name),
  UNIQUE KEY uq_formal_menu_groups_key (`key`),
  KEY idx_formal_menu_groups_active_order (is_active, sort_order)
) ENGINE=InnoDB;

/* -------------------------------------------------------------------------- */
/* 2) Create simplified item tables                                            */
/* -------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS general_menu_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  `key` VARCHAR(128) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  group_id BIGINT UNSIGNED NOT NULL,
  half_tray_price DECIMAL(10,2) NOT NULL,
  full_tray_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_general_menu_items_key (`key`),
  KEY idx_general_menu_items_active (is_active),
  KEY idx_general_menu_items_group_id (group_id),
  KEY idx_general_menu_items_active_group (is_active, group_id),
  CONSTRAINT fk_general_menu_items_group
    FOREIGN KEY (group_id) REFERENCES general_menu_groups(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

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
  KEY idx_formal_menu_items_active (is_active),
  KEY idx_formal_menu_items_group_id (group_id),
  KEY idx_formal_menu_items_active_group (is_active, group_id),
  CONSTRAINT fk_formal_menu_items_group
    FOREIGN KEY (group_id) REFERENCES formal_menu_groups(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

/* -------------------------------------------------------------------------- */
/* 3) Seed required groups                                                     */
/* -------------------------------------------------------------------------- */
INSERT INTO general_menu_groups (`key`, name, sort_order, is_active)
VALUES
  ('entree', 'Entree', 1, 1),
  ('signature_protein', 'Signature Protein', 2, 1),
  ('side', 'Side', 3, 1),
  ('salad', 'Salad', 4, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  sort_order = VALUES(sort_order),
  is_active = VALUES(is_active),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO formal_menu_groups (`key`, name, sort_order, is_active)
VALUES
  ('passed_appetizers', 'Passed Appetizers', 1, 1),
  ('starter', 'Starter', 2, 1),
  ('sides', 'Sides', 3, 1),
  ('entrees', 'Entrees', 4, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  sort_order = VALUES(sort_order),
  is_active = VALUES(is_active),
  updated_at = CURRENT_TIMESTAMP;

/* -------------------------------------------------------------------------- */
/* 4) Reset only new item tables                                               */
/* -------------------------------------------------------------------------- */
DELETE FROM general_menu_items;
DELETE FROM formal_menu_items;

/* -------------------------------------------------------------------------- */
/* 5) Backfill GENERAL items + prices from legacy schema                       */
/* -------------------------------------------------------------------------- */
INSERT INTO general_menu_items (`key`, name, is_active, group_id, half_tray_price, full_tray_price)
WITH
legacy_general_option AS (
  SELECT DISTINCT
    TRIM(mi.item_name) AS item_name,
    CASE
      WHEN LOWER(COALESCE(mog.option_key, '')) = 'signature_protein' THEN 'signature_protein'
      WHEN LOWER(COALESCE(mog.category, '')) IN ('salad', 'salads') THEN 'salad'
      WHEN LOWER(COALESCE(mog.category, '')) IN ('side', 'sides', 'sides_salad', 'sides_salads', 'sidessalad')
        THEN CASE WHEN LOWER(mi.item_name) LIKE '%salad%' THEN 'salad' ELSE 'side' END
      WHEN LOWER(COALESCE(mog.category, '')) IN ('entree', 'entrees', 'protein', 'proteins') THEN 'entree'
      ELSE 'entree'
    END AS group_key,
    1 AS source_priority
  FROM menu_option_group_items mogi
  JOIN menu_option_groups mog ON mog.id = mogi.group_id AND mog.is_active = 1
  JOIN menu_items mi ON mi.id = mogi.item_id AND mi.is_active = 1
  WHERE mogi.is_active = 1
    AND TRIM(mi.item_name) <> ''
),
legacy_general_togo AS (
  SELECT DISTINCT
    TRIM(mi.item_name) AS item_name,
    CASE
      WHEN LOWER(COALESCE(s.category, '')) IN ('salad', 'salads') THEN 'salad'
      WHEN LOWER(COALESCE(s.category, '')) IN ('side', 'sides', 'sides_salad', 'sides_salads')
        THEN CASE WHEN LOWER(mi.item_name) LIKE '%salad%' THEN 'salad' ELSE 'side' END
      WHEN LOWER(COALESCE(s.category, '')) IN ('entree', 'entrees', 'protein', 'proteins') THEN 'entree'
      ELSE 'entree'
    END AS group_key,
    2 AS source_priority
  FROM menu_section_rows r
  JOIN menu_sections s ON s.id = r.section_id AND s.is_active = 1
  JOIN menu_catalogs c ON c.id = s.catalog_id AND c.is_active = 1
  JOIN menu_items mi ON mi.id = r.item_id AND mi.is_active = 1
  WHERE r.is_active = 1
    AND c.catalog_key = 'togo'
    AND TRIM(mi.item_name) <> ''
),
legacy_general_union AS (
  SELECT * FROM legacy_general_option
  UNION ALL
  SELECT * FROM legacy_general_togo
),
legacy_general_ranked AS (
  SELECT
    item_name,
    group_key,
    ROW_NUMBER() OVER (PARTITION BY item_name ORDER BY source_priority ASC, group_key ASC) AS rn
  FROM legacy_general_union
),
legacy_general_items AS (
  SELECT item_name, group_key
  FROM legacy_general_ranked
  WHERE rn = 1
),
legacy_general_prices AS (
  SELECT
    TRIM(mi.item_name) AS item_name,
    MAX(CAST(REGEXP_SUBSTR(REPLACE(REPLACE(COALESCE(r.value_1, ''), '$', ''), ',', ''), '[0-9]+(\\.[0-9]{1,2})?') AS DECIMAL(10,2))) AS half_raw,
    MAX(CAST(REGEXP_SUBSTR(REPLACE(REPLACE(COALESCE(r.value_2, ''), '$', ''), ',', ''), '[0-9]+(\\.[0-9]{1,2})?') AS DECIMAL(10,2))) AS full_raw
  FROM menu_section_rows r
  JOIN menu_sections s ON s.id = r.section_id AND s.is_active = 1
  JOIN menu_catalogs c ON c.id = s.catalog_id AND c.is_active = 1
  JOIN menu_items mi ON mi.id = r.item_id AND mi.is_active = 1
  WHERE r.is_active = 1
    AND c.catalog_key = 'togo'
  GROUP BY TRIM(mi.item_name)
),
general_pre_keys AS (
  SELECT
    gi.item_name,
    gi.group_key,
    GREATEST(COALESCE(gp.half_raw, gp.full_raw, 0.00), 0.00) AS half_tray_price,
    GREATEST(COALESCE(gp.full_raw, gp.half_raw, 0.00), 0.00) AS full_tray_price,
    CASE
      WHEN LEFT(TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(gi.item_name), '[^a-z0-9]+', '-')), 120) = '' THEN 'item'
      ELSE LEFT(TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(gi.item_name), '[^a-z0-9]+', '-')), 120)
    END AS base_key
  FROM legacy_general_items gi
  LEFT JOIN legacy_general_prices gp ON gp.item_name = gi.item_name
),
general_keyed AS (
  SELECT
    item_name,
    group_key,
    half_tray_price,
    full_tray_price,
    base_key,
    ROW_NUMBER() OVER (PARTITION BY base_key ORDER BY item_name ASC) AS key_seq
  FROM general_pre_keys
),
general_final AS (
  SELECT
    item_name,
    group_key,
    half_tray_price,
    full_tray_price,
    LEFT(CASE WHEN key_seq = 1 THEN base_key ELSE CONCAT(base_key, '-', key_seq) END, 128) AS item_key
  FROM general_keyed
)
SELECT
  gf.item_key,
  gf.item_name,
  1,
  gmg.id,
  gf.half_tray_price,
  gf.full_tray_price
FROM general_final gf
JOIN general_menu_groups gmg ON gmg.`key` = gf.group_key;

/* -------------------------------------------------------------------------- */
/* 6) Backfill FORMAL items from legacy schema                                 */
/* -------------------------------------------------------------------------- */
INSERT INTO formal_menu_items (`key`, name, is_active, group_id)
WITH
legacy_formal AS (
  SELECT DISTINCT
    TRIM(COALESCE(mi.item_name, mstb.bullet_text)) AS item_name,
    CASE
      WHEN LOWER(CONCAT_WS(' ', ms.course_type, ms.section_key, ms.title)) LIKE '%passed%' THEN 'passed_appetizers'
      WHEN LOWER(CONCAT_WS(' ', ms.course_type, ms.section_key, ms.title)) LIKE '%starter%' THEN 'starter'
      WHEN LOWER(CONCAT_WS(' ', ms.course_type, ms.section_key, ms.title)) LIKE '%side%' THEN 'sides'
      ELSE 'entrees'
    END AS group_key
  FROM menu_sections ms
  JOIN menu_catalogs mc ON mc.id = ms.catalog_id AND mc.is_active = 1
  JOIN menu_section_tiers mst ON mst.section_id = ms.id AND mst.is_active = 1
  JOIN menu_section_tier_bullets mstb ON mstb.tier_id = mst.id AND mstb.is_active = 1
  LEFT JOIN menu_items mi ON mi.id = mstb.item_id AND mi.is_active = 1
  WHERE ms.is_active = 1
    AND mc.catalog_key = 'formal'
    AND TRIM(COALESCE(mi.item_name, mstb.bullet_text)) <> ''
),
formal_pre_keys AS (
  SELECT
    lf.item_name,
    lf.group_key,
    CASE
      WHEN LEFT(TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(lf.item_name), '[^a-z0-9]+', '-')), 120) = '' THEN 'item'
      ELSE LEFT(TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(lf.item_name), '[^a-z0-9]+', '-')), 120)
    END AS base_key
  FROM legacy_formal lf
),
formal_keyed AS (
  SELECT
    item_name,
    group_key,
    base_key,
    ROW_NUMBER() OVER (PARTITION BY base_key ORDER BY item_name ASC) AS key_seq
  FROM formal_pre_keys
),
formal_final AS (
  SELECT
    item_name,
    group_key,
    LEFT(CASE WHEN key_seq = 1 THEN base_key ELSE CONCAT(base_key, '-', key_seq) END, 128) AS item_key
  FROM formal_keyed
)
SELECT
  ff.item_key,
  ff.item_name,
  1,
  fmg.id
FROM formal_final ff
JOIN formal_menu_groups fmg ON fmg.`key` = ff.group_key;

/* -------------------------------------------------------------------------- */
/* 7) Validation queries (review before COMMIT)                                */
/* -------------------------------------------------------------------------- */
SELECT 'general_menu_groups' AS table_name, COUNT(*) AS row_count FROM general_menu_groups
UNION ALL
SELECT 'general_menu_items', COUNT(*) FROM general_menu_items
UNION ALL
SELECT 'formal_menu_groups', COUNT(*) FROM formal_menu_groups
UNION ALL
SELECT 'formal_menu_items', COUNT(*) FROM formal_menu_items;

SELECT `key`, COUNT(*) AS cnt
FROM general_menu_items
GROUP BY `key`
HAVING COUNT(*) > 1;

SELECT `key`, COUNT(*) AS cnt
FROM formal_menu_items
GROUP BY `key`
HAVING COUNT(*) > 1;

SELECT id, name, half_tray_price, full_tray_price
FROM general_menu_items
WHERE half_tray_price < 0 OR full_tray_price < 0;

SELECT i.id, i.name, g.`key` AS group_key
FROM general_menu_items i
LEFT JOIN general_menu_groups g ON g.id = i.group_id
WHERE g.id IS NULL;

SELECT i.id, i.name, g.`key` AS group_key
FROM formal_menu_items i
LEFT JOIN formal_menu_groups g ON g.id = i.group_id
WHERE g.id IS NULL;

-- If validation looks good:
-- COMMIT;

-- If anything looks wrong:
-- ROLLBACK;
