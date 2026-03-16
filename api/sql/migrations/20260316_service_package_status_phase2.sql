USE post_catering;

START TRANSACTION;

UPDATE service_plans
SET
  is_active = 0,
  updated_at = CURRENT_TIMESTAMP
WHERE plan_key = 'formal:2-course';

SET @has_is_public_visible := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'service_plans'
    AND COLUMN_NAME = 'is_public_visible'
);

SET @drop_is_public_visible_sql := IF(
  @has_is_public_visible > 0,
  'ALTER TABLE service_plans DROP COLUMN is_public_visible',
  'SELECT 1'
);

PREPARE drop_is_public_visible_stmt FROM @drop_is_public_visible_sql;
EXECUTE drop_is_public_visible_stmt;
DEALLOCATE PREPARE drop_is_public_visible_stmt;

SET @has_is_inquiry_selectable := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'service_plans'
    AND COLUMN_NAME = 'is_inquiry_selectable'
);

SET @drop_is_inquiry_selectable_sql := IF(
  @has_is_inquiry_selectable > 0,
  'ALTER TABLE service_plans DROP COLUMN is_inquiry_selectable',
  'SELECT 1'
);

PREPARE drop_is_inquiry_selectable_stmt FROM @drop_is_inquiry_selectable_sql;
EXECUTE drop_is_inquiry_selectable_stmt;
DEALLOCATE PREPARE drop_is_inquiry_selectable_stmt;

COMMIT;
