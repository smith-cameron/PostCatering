USE post_catering;

START TRANSACTION;

CREATE TABLE IF NOT EXISTS service_plan_sections (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  catalog_key VARCHAR(32) NOT NULL,
  section_key VARCHAR(64) NOT NULL,
  section_type VARCHAR(32) NOT NULL,
  public_section_id VARCHAR(64) NULL,
  title VARCHAR(150) NOT NULL,
  note TEXT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_service_plan_sections_key (section_key),
  UNIQUE KEY uq_service_plan_sections_catalog_order (catalog_key, sort_order),
  UNIQUE KEY uq_service_plan_sections_public_id (public_section_id),
  KEY idx_service_plan_sections_catalog_type (catalog_key, section_type, is_active)
);

CREATE TABLE IF NOT EXISTS service_plans (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  section_id BIGINT UNSIGNED NOT NULL,
  plan_key VARCHAR(64) NOT NULL,
  title VARCHAR(150) NOT NULL,
  price_display VARCHAR(120) NULL,
  price_amount_min DECIMAL(10,2) NULL,
  price_amount_max DECIMAL(10,2) NULL,
  price_currency CHAR(3) NULL,
  price_unit VARCHAR(32) NULL,
  selection_mode VARCHAR(32) NOT NULL DEFAULT 'menu_groups',
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_service_plans_key (plan_key),
  UNIQUE KEY uq_service_plans_section_order (section_id, sort_order),
  KEY idx_service_plans_section_active (section_id, is_active, sort_order),
  CONSTRAINT fk_service_plans_section FOREIGN KEY (section_id) REFERENCES service_plan_sections(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS service_plan_constraints (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  service_plan_id BIGINT UNSIGNED NOT NULL,
  selection_key VARCHAR(64) NOT NULL,
  min_select INT UNSIGNED NULL,
  max_select INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_service_plan_constraints_plan_selection (service_plan_id, selection_key),
  KEY idx_service_plan_constraints_selection (selection_key),
  CONSTRAINT fk_service_plan_constraints_plan FOREIGN KEY (service_plan_id) REFERENCES service_plans(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS service_plan_details (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  service_plan_id BIGINT UNSIGNED NOT NULL,
  detail_text VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_service_plan_details_plan_order (service_plan_id, sort_order),
  CONSTRAINT fk_service_plan_details_plan FOREIGN KEY (service_plan_id) REFERENCES service_plans(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS service_section_menu_groups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  section_id BIGINT UNSIGNED NOT NULL,
  menu_group_key VARCHAR(64) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_service_section_menu_groups_section_key (section_id, menu_group_key),
  UNIQUE KEY uq_service_section_menu_groups_section_order (section_id, sort_order),
  CONSTRAINT fk_service_section_menu_groups_section FOREIGN KEY (section_id) REFERENCES service_plan_sections(id) ON DELETE CASCADE
);

SET @has_selection_mode_column := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'service_plans'
    AND COLUMN_NAME = 'selection_mode'
);

SET @add_selection_mode_sql := IF(
  @has_selection_mode_column > 0,
  'SELECT 1',
  'ALTER TABLE service_plans ADD COLUMN selection_mode VARCHAR(32) NOT NULL DEFAULT ''menu_groups'' AFTER price_unit'
);

PREPARE add_selection_mode_stmt FROM @add_selection_mode_sql;
EXECUTE add_selection_mode_stmt;
DEALLOCATE PREPARE add_selection_mode_stmt;

SET @has_level_column := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'service_plans'
    AND COLUMN_NAME = 'level'
);

SET @drop_level_sql := IF(
  @has_level_column > 0,
  'ALTER TABLE service_plans DROP COLUMN level',
  'SELECT 1'
);

PREPARE drop_level_stmt FROM @drop_level_sql;
EXECUTE drop_level_stmt;
DEALLOCATE PREPARE drop_level_stmt;

CREATE TABLE IF NOT EXISTS service_plan_selection_groups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  service_plan_id BIGINT UNSIGNED NOT NULL,
  group_key VARCHAR(64) NOT NULL,
  group_title VARCHAR(150) NOT NULL,
  source_type VARCHAR(32) NOT NULL DEFAULT 'custom_options',
  menu_group_key VARCHAR(64) NULL,
  min_select INT UNSIGNED NULL,
  max_select INT UNSIGNED NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_service_plan_selection_groups_plan_key (service_plan_id, group_key),
  UNIQUE KEY uq_service_plan_selection_groups_plan_order (service_plan_id, sort_order),
  CONSTRAINT fk_service_plan_selection_groups_plan FOREIGN KEY (service_plan_id) REFERENCES service_plans(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS service_plan_selection_options (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  selection_group_id BIGINT UNSIGNED NOT NULL,
  option_key VARCHAR(64) NOT NULL,
  option_label VARCHAR(150) NOT NULL,
  menu_item_id BIGINT UNSIGNED NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_service_plan_selection_options_group_key (selection_group_id, option_key),
  UNIQUE KEY uq_service_plan_selection_options_group_order (selection_group_id, sort_order),
  CONSTRAINT fk_service_plan_selection_options_group FOREIGN KEY (selection_group_id) REFERENCES service_plan_selection_groups(id) ON DELETE CASCADE,
  CONSTRAINT fk_service_plan_selection_options_menu_item FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL
);

INSERT INTO service_plan_sections (
  catalog_key,
  section_key,
  section_type,
  public_section_id,
  title,
  note,
  sort_order,
  is_active
)
SELECT seeded.catalog_key, seeded.section_key, seeded.section_type, seeded.public_section_id, seeded.title, seeded.note, seeded.sort_order, seeded.is_active
FROM (
  SELECT 'catering' AS catalog_key, 'catering_packages' AS section_key, 'packages' AS section_type, 'catering_packages' AS public_section_id, 'Catering Packages' AS title, NULL AS note, 1 AS sort_order, 1 AS is_active
  UNION ALL
  SELECT 'catering', 'catering_menu_options', 'include_menu', 'catering_menu_options', 'Menu Options', NULL, 2, 1
  UNION ALL
  SELECT 'formal', 'formal_packages', 'packages', 'formal_packages', 'Formal Dinner Packages', NULL, 1, 1
) seeded
LEFT JOIN service_plan_sections existing ON existing.section_key = seeded.section_key
WHERE existing.id IS NULL;

SET @catering_packages_section_id := (
  SELECT id
  FROM service_plan_sections
  WHERE section_key = 'catering_packages'
  LIMIT 1
);

SET @catering_menu_options_section_id := (
  SELECT id
  FROM service_plan_sections
  WHERE section_key = 'catering_menu_options'
  LIMIT 1
);

SET @formal_packages_section_id := (
  SELECT id
  FROM service_plan_sections
  WHERE section_key = 'formal_packages'
  LIMIT 1
);

DELETE legacy
FROM service_plans legacy
JOIN service_plans canonical
  ON canonical.plan_key = CONCAT('catering:', SUBSTRING_INDEX(legacy.plan_key, ':', -1))
WHERE legacy.plan_key LIKE 'community:%';

UPDATE service_plans
SET plan_key = CONCAT('catering:', SUBSTRING_INDEX(plan_key, ':', -1))
WHERE plan_key LIKE 'community:%';

UPDATE service_plans
SET sort_order = CASE
  WHEN plan_key IN ('community:taco_bar', 'catering:taco_bar') THEN 1
  WHEN plan_key IN ('community:homestyle', 'catering:homestyle') THEN 2
  WHEN plan_key IN ('community:buffet_tier_1', 'catering:buffet_tier_1') THEN 3
  WHEN plan_key IN ('community:buffet_tier_2', 'catering:buffet_tier_2') THEN 4
  WHEN plan_key = 'formal:2-course' THEN 1
  WHEN plan_key = 'formal:3-course' THEN 2
  ELSE sort_order
END
WHERE plan_key IN (
  'community:taco_bar',
  'catering:taco_bar',
  'community:homestyle',
  'catering:homestyle',
  'community:buffet_tier_1',
  'catering:buffet_tier_1',
  'community:buffet_tier_2',
  'catering:buffet_tier_2',
  'formal:2-course',
  'formal:3-course'
);

UPDATE service_plans p
JOIN service_plan_sections s ON s.id = p.section_id
SET p.section_id = @catering_packages_section_id
WHERE @catering_packages_section_id IS NOT NULL
  AND s.section_key IN ('community_taco_bar', 'community_homestyle', 'community_buffet_packages', 'community_buffet_tiers')
  AND p.section_id <> @catering_packages_section_id;

UPDATE service_plans
SET selection_mode = CASE
  WHEN plan_key = 'catering:taco_bar' THEN 'custom_options'
  WHEN plan_key IN (
    'catering:homestyle',
    'catering:buffet_tier_1',
    'catering:buffet_tier_2',
    'formal:2-course',
    'formal:3-course'
  ) THEN 'menu_groups'
  ELSE COALESCE(NULLIF(selection_mode, ''), 'menu_groups')
END;

DELETE s
FROM service_plan_sections s
LEFT JOIN service_plans p ON p.section_id = s.id
WHERE s.section_key IN ('community_taco_bar', 'community_homestyle', 'community_buffet_packages', 'community_buffet_tiers')
  AND p.id IS NULL;

DELETE s
FROM service_plan_sections s
LEFT JOIN service_section_menu_groups g ON g.section_id = s.id
WHERE s.section_key = 'community_menu_options'
  AND g.id IS NULL;

INSERT INTO service_plans (
  section_id,
  plan_key,
  title,
  price_display,
  price_amount_min,
  price_amount_max,
  price_currency,
  price_unit,
  selection_mode,
  sort_order,
  is_active
)
SELECT
  sections.id,
  seeded.plan_key,
  seeded.title,
  seeded.price_display,
  seeded.price_amount_min,
  seeded.price_amount_max,
  seeded.price_currency,
  seeded.price_unit,
  seeded.selection_mode,
  seeded.sort_order,
  seeded.is_active
FROM (
  SELECT 'catering_packages' AS section_key, 'catering:taco_bar' AS plan_key, 'Taco Bar' AS title, '$18-$25 per person' AS price_display, 18.00 AS price_amount_min, 25.00 AS price_amount_max, 'USD' AS price_currency, 'per_person' AS price_unit, 'custom_options' AS selection_mode, 1 AS sort_order, 1 AS is_active
  UNION ALL
  SELECT 'catering_packages', 'catering:homestyle', 'Hearty Homestyle Packages', '$20-$28 per person', 20.00, 28.00, 'USD', 'per_person', 'menu_groups', 2, 1
  UNION ALL
  SELECT 'catering_packages', 'catering:buffet_tier_1', 'Tier 1: Casual Buffet', '$30-$40 per person', 30.00, 40.00, 'USD', 'per_person', 'menu_groups', 3, 1
  UNION ALL
  SELECT 'catering_packages', 'catering:buffet_tier_2', 'Tier 2: Elevated Buffet / Family-Style', '$45-$65 per person', 45.00, 65.00, 'USD', 'per_person', 'menu_groups', 4, 1
  UNION ALL
  SELECT 'formal_packages', 'formal:2-course', 'Two-Course Dinner', '$65-$90 per person', 65.00, 90.00, 'USD', 'per_person', 'menu_groups', 1, 0
  UNION ALL
  SELECT 'formal_packages', 'formal:3-course', 'Three-Course Dinner', '$75-$110+ per person', 75.00, 110.00, 'USD', 'per_person', 'menu_groups', 2, 1
) seeded
JOIN service_plan_sections sections ON sections.section_key = seeded.section_key
LEFT JOIN service_plans existing ON existing.plan_key = seeded.plan_key
WHERE existing.id IS NULL;

INSERT INTO service_plan_constraints (
  service_plan_id,
  selection_key,
  min_select,
  max_select
)
SELECT
  plans.id,
  seeded.selection_key,
  seeded.min_select,
  seeded.max_select
FROM (
  SELECT 'catering:taco_bar' AS plan_key, 'signature_protein' AS selection_key, 1 AS min_select, 1 AS max_select
  UNION ALL SELECT 'catering:homestyle', 'entree_signature_protein', 1, 1
  UNION ALL SELECT 'catering:homestyle', 'sides_salads', 2, 2
  UNION ALL SELECT 'catering:buffet_tier_1', 'entree_signature_protein', 2, 2
  UNION ALL SELECT 'catering:buffet_tier_1', 'sides_salads', 3, 3
  UNION ALL SELECT 'catering:buffet_tier_2', 'entree_signature_protein', 2, 3
  UNION ALL SELECT 'catering:buffet_tier_2', 'sides_salads', 5, 5
  UNION ALL SELECT 'formal:2-course', 'starter', 1, 1
  UNION ALL SELECT 'formal:2-course', 'entree', 1, 1
  UNION ALL SELECT 'formal:3-course', 'passed', 2, 2
  UNION ALL SELECT 'formal:3-course', 'starter', 1, 1
  UNION ALL SELECT 'formal:3-course', 'entree', 1, 2
) seeded
JOIN service_plans plans ON plans.plan_key = seeded.plan_key
LEFT JOIN service_plan_constraints existing
  ON existing.service_plan_id = plans.id
 AND (
   existing.selection_key = seeded.selection_key
   OR (
     seeded.selection_key = 'entree_signature_protein'
     AND existing.selection_key IN ('entree', 'entrees', 'protein', 'proteins', 'signature_protein', 'signature_proteins')
   )
   OR (
     seeded.selection_key = 'signature_protein'
     AND plans.plan_key = 'catering:taco_bar'
     AND existing.selection_key = 'entree'
   )
 )
WHERE existing.id IS NULL;

INSERT INTO service_plan_details (
  service_plan_id,
  detail_text,
  sort_order
)
SELECT
  plans.id,
  seeded.detail_text,
  seeded.sort_order
FROM (
  SELECT 'catering:taco_bar' AS plan_key, 'Spanish rice' AS detail_text, 1 AS sort_order
  UNION ALL SELECT 'catering:taco_bar', 'Refried beans', 2
  UNION ALL SELECT 'catering:taco_bar', 'Tortillas', 3
  UNION ALL SELECT 'catering:taco_bar', 'Toppings', 4
  UNION ALL SELECT 'catering:homestyle', 'Bread', 1
  UNION ALL SELECT 'catering:buffet_tier_1', 'Bread', 1
  UNION ALL SELECT 'catering:buffet_tier_2', 'Bread', 1
  UNION ALL SELECT 'formal:2-course', '1 Starter', 1
  UNION ALL SELECT 'formal:2-course', '1 Entree', 2
  UNION ALL SELECT 'formal:2-course', 'Bread', 3
  UNION ALL SELECT 'formal:3-course', '2 Passed Appetizers', 1
  UNION ALL SELECT 'formal:3-course', '1 Starter', 2
  UNION ALL SELECT 'formal:3-course', '1 or 2 Entrees', 3
  UNION ALL SELECT 'formal:3-course', 'Bread', 4
) seeded
JOIN service_plans plans ON plans.plan_key = seeded.plan_key
LEFT JOIN service_plan_details existing
  ON existing.service_plan_id = plans.id
 AND existing.sort_order = seeded.sort_order
WHERE existing.id IS NULL;

INSERT INTO service_section_menu_groups (
  section_id,
  menu_group_key,
  sort_order
)
SELECT
  sections.id,
  seeded.menu_group_key,
  seeded.sort_order
FROM (
  SELECT 'catering_menu_options' AS section_key, 'entree' AS menu_group_key, 1 AS sort_order
  UNION ALL SELECT 'catering_menu_options', 'signature_protein', 2
  UNION ALL SELECT 'catering_menu_options', 'side', 3
  UNION ALL SELECT 'catering_menu_options', 'salad', 4
) seeded
JOIN service_plan_sections sections ON sections.section_key = seeded.section_key
LEFT JOIN service_section_menu_groups existing
  ON existing.section_id = sections.id
 AND existing.menu_group_key = seeded.menu_group_key
WHERE existing.id IS NULL;

INSERT INTO service_plan_selection_groups (
  service_plan_id,
  group_key,
  group_title,
  source_type,
  menu_group_key,
  min_select,
  max_select,
  sort_order,
  is_active
)
SELECT
  p.id,
  seeded.group_key,
  seeded.group_title,
  seeded.source_type,
  seeded.menu_group_key,
  seeded.min_select,
  seeded.max_select,
  seeded.sort_order,
  seeded.is_active
FROM (
  SELECT 'catering:taco_bar' AS plan_key, 'signature_protein' AS group_key, 'Taco Bar Proteins' AS group_title, 'custom_options' AS source_type, NULL AS menu_group_key, 1 AS min_select, 1 AS max_select, 1 AS sort_order, 1 AS is_active
) seeded
JOIN service_plans p ON p.plan_key = seeded.plan_key
LEFT JOIN service_plan_selection_groups existing
  ON existing.service_plan_id = p.id
 AND (
   existing.group_key = seeded.group_key
   OR (
     seeded.group_key = 'signature_protein'
     AND p.plan_key = 'catering:taco_bar'
     AND existing.group_key = 'entree'
   )
 )
WHERE existing.id IS NULL;

INSERT INTO service_plan_selection_options (
  selection_group_id,
  option_key,
  option_label,
  menu_item_id,
  sort_order,
  is_active
)
SELECT
  g.id,
  seeded.option_key,
  seeded.option_label,
  NULL,
  seeded.sort_order,
  1
FROM (
  SELECT 'catering:taco_bar' AS plan_key, 'signature_protein' AS group_key, 'carne_asada' AS option_key, 'Carne Asada' AS option_label, 1 AS sort_order
  UNION ALL SELECT 'catering:taco_bar', 'signature_protein', 'chicken', 'Chicken', 2
  UNION ALL SELECT 'catering:taco_bar', 'signature_protein', 'marinated_pork', 'Marinated Pork', 3
) seeded
JOIN service_plans p ON p.plan_key = seeded.plan_key
JOIN service_plan_selection_groups g
  ON g.service_plan_id = p.id
 AND (
   g.group_key = seeded.group_key
   OR (
     seeded.group_key = 'signature_protein'
     AND p.plan_key = 'catering:taco_bar'
     AND g.group_key = 'entree'
   )
 )
LEFT JOIN service_plan_selection_options existing
  ON existing.selection_group_id = g.id
 AND existing.option_key = seeded.option_key
WHERE existing.id IS NULL;

COMMIT;
