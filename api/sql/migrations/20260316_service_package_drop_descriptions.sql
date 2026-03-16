START TRANSACTION;

SET @has_service_plan_sections_description := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'service_plan_sections'
    AND COLUMN_NAME = 'description'
);

SET @has_service_plans_description := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'service_plans'
    AND COLUMN_NAME = 'description'
);

SET @migrate_section_descriptions_sql := IF(
  @has_service_plan_sections_description > 0,
  'UPDATE service_plan_sections
   SET note = CASE
     WHEN COALESCE(TRIM(note), '''') = '''' AND COALESCE(TRIM(description), '''') <> '''' THEN TRIM(description)
     ELSE note
   END
   WHERE COALESCE(TRIM(description), '''') <> '''';',
  'SELECT 1'
);

PREPARE migrate_section_descriptions_stmt FROM @migrate_section_descriptions_sql;
EXECUTE migrate_section_descriptions_stmt;
DEALLOCATE PREPARE migrate_section_descriptions_stmt;

SET @migrate_plan_descriptions_sql := IF(
  @has_service_plans_description > 0,
  'INSERT INTO service_plan_details (service_plan_id, detail_text, sort_order)
   SELECT
     p.id,
     CASE
       WHEN LOWER(TRIM(p.description)) LIKE ''includes %'' THEN TRIM(SUBSTRING(TRIM(p.description), 10))
       ELSE TRIM(p.description)
     END AS detail_text,
     COALESCE(detail_stats.max_sort_order, 0) + 1 AS sort_order
   FROM service_plans p
   LEFT JOIN (
     SELECT service_plan_id, COUNT(*) AS detail_count, MAX(sort_order) AS max_sort_order
     FROM service_plan_details
     GROUP BY service_plan_id
   ) detail_stats ON detail_stats.service_plan_id = p.id
   LEFT JOIN (
     SELECT service_plan_id, COUNT(*) AS constraint_count
     FROM service_plan_constraints
     GROUP BY service_plan_id
   ) constraint_stats ON constraint_stats.service_plan_id = p.id
   LEFT JOIN (
     SELECT service_plan_id, COUNT(*) AS selection_group_count
     FROM service_plan_selection_groups
     GROUP BY service_plan_id
   ) selection_group_stats ON selection_group_stats.service_plan_id = p.id
   WHERE COALESCE(TRIM(p.description), '''') <> ''''
     AND COALESCE(detail_stats.detail_count, 0) = 0
     AND (
       LOWER(TRIM(p.description)) LIKE ''includes %''
       OR (
         COALESCE(constraint_stats.constraint_count, 0) = 0
         AND COALESCE(selection_group_stats.selection_group_count, 0) = 0
       )
     );',
  'SELECT 1'
);

PREPARE migrate_plan_descriptions_stmt FROM @migrate_plan_descriptions_sql;
EXECUTE migrate_plan_descriptions_stmt;
DEALLOCATE PREPARE migrate_plan_descriptions_stmt;

SET @drop_service_plan_sections_description_sql := IF(
  @has_service_plan_sections_description > 0,
  'ALTER TABLE service_plan_sections DROP COLUMN description',
  'SELECT 1'
);

PREPARE drop_service_plan_sections_description_stmt FROM @drop_service_plan_sections_description_sql;
EXECUTE drop_service_plan_sections_description_stmt;
DEALLOCATE PREPARE drop_service_plan_sections_description_stmt;

SET @drop_service_plans_description_sql := IF(
  @has_service_plans_description > 0,
  'ALTER TABLE service_plans DROP COLUMN description',
  'SELECT 1'
);

PREPARE drop_service_plans_description_stmt FROM @drop_service_plans_description_sql;
EXECUTE drop_service_plans_description_stmt;
DEALLOCATE PREPARE drop_service_plans_description_stmt;

COMMIT;
