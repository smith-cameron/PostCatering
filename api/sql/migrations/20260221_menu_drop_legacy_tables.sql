USE post_catering;

-- Drop legacy menu graph tables (child -> parent order).
DROP TABLE IF EXISTS menu_section_tier_bullets;
DROP TABLE IF EXISTS menu_section_tier_constraints;
DROP TABLE IF EXISTS menu_section_tiers;
DROP TABLE IF EXISTS menu_section_include_groups;
DROP TABLE IF EXISTS menu_section_rows;
DROP TABLE IF EXISTS menu_section_columns;
DROP TABLE IF EXISTS menu_section_constraints;
DROP TABLE IF EXISTS menu_sections;
DROP TABLE IF EXISTS menu_intro_bullets;
DROP TABLE IF EXISTS menu_intro_blocks;
DROP TABLE IF EXISTS formal_plan_option_constraints;
DROP TABLE IF EXISTS formal_plan_option_details;
DROP TABLE IF EXISTS formal_plan_options;
DROP TABLE IF EXISTS menu_option_group_items;
DROP TABLE IF EXISTS menu_option_groups;
DROP TABLE IF EXISTS menu_items;
DROP TABLE IF EXISTS menu_catalogs;

-- Remove legacy cached catalog payload key (keep menu_config table for other config).
DELETE FROM menu_config
WHERE config_key = 'catalog_payload_v1';
