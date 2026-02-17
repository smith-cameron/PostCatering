CREATE DATABASE IF NOT EXISTS post_catering;
USE post_catering;

CREATE TABLE IF NOT EXISTS slides (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(150) NULL,
  caption TEXT NULL,
  image_url VARCHAR(1024) NOT NULL,
  alt_text VARCHAR(255) NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_slides_active_order (is_active, display_order),
  UNIQUE KEY uq_slides_image_url (image_url(191))
);

CREATE TABLE IF NOT EXISTS inquiries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(40) NULL,
  event_type VARCHAR(100) NULL,
  event_date DATE NULL,
  guest_count INT NULL,
  budget VARCHAR(100) NULL,
  service_interest VARCHAR(255) NULL,
  message TEXT NOT NULL,
  status ENUM('new', 'read', 'closed') NOT NULL DEFAULT 'new',
  email_sent TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_inquiries_email (email),
  KEY idx_inquiries_event_date (event_date),
  KEY idx_inquiries_status_created (status, created_at)
);

CREATE TABLE IF NOT EXISTS menu_config (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  config_key VARCHAR(64) NOT NULL,
  config_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_menu_config_key (config_key)
);

CREATE TABLE IF NOT EXISTS menu_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_key VARCHAR(128) NULL,
  item_name VARCHAR(255) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_menu_items_name (item_name),
  UNIQUE KEY uq_menu_items_key (item_key)
);

CREATE TABLE IF NOT EXISTS menu_option_groups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  option_key VARCHAR(100) NOT NULL,
  option_id VARCHAR(128) NOT NULL,
  category VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_menu_option_groups_key (option_key),
  UNIQUE KEY uq_menu_option_groups_option_id (option_id),
  KEY idx_menu_option_groups_active_order (is_active, display_order)
);

CREATE TABLE IF NOT EXISTS menu_option_group_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  group_id BIGINT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_menu_option_group_item (group_id, item_id),
  UNIQUE KEY uq_menu_option_group_order (group_id, display_order),
  KEY idx_menu_option_group_items_active (is_active),
  CONSTRAINT fk_menu_option_group_items_group FOREIGN KEY (group_id) REFERENCES menu_option_groups(id) ON DELETE CASCADE,
  CONSTRAINT fk_menu_option_group_items_item FOREIGN KEY (item_id) REFERENCES menu_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS formal_plan_options (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  plan_key VARCHAR(100) NOT NULL,
  option_level VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  price VARCHAR(100) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_formal_plan_options_plan_key (plan_key),
  KEY idx_formal_plan_options_active_order (is_active, display_order)
);

CREATE TABLE IF NOT EXISTS formal_plan_option_details (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  plan_option_id BIGINT UNSIGNED NOT NULL,
  detail_text VARCHAR(255) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_formal_plan_detail_order (plan_option_id, display_order),
  KEY idx_formal_plan_option_details_active (is_active),
  CONSTRAINT fk_formal_plan_option_details_option FOREIGN KEY (plan_option_id) REFERENCES formal_plan_options(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS formal_plan_option_constraints (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  plan_option_id BIGINT UNSIGNED NOT NULL,
  constraint_key VARCHAR(100) NOT NULL,
  min_select INT NOT NULL,
  max_select INT NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_formal_plan_constraint (plan_option_id, constraint_key),
  KEY idx_formal_plan_option_constraints_active (is_active),
  CONSTRAINT fk_formal_plan_option_constraints_option FOREIGN KEY (plan_option_id) REFERENCES formal_plan_options(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS menu_catalogs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  catalog_key VARCHAR(50) NOT NULL,
  page_title VARCHAR(255) NOT NULL,
  subtitle VARCHAR(255) NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_menu_catalogs_key (catalog_key),
  KEY idx_menu_catalogs_active_order (is_active, display_order)
);

CREATE TABLE IF NOT EXISTS menu_intro_blocks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  catalog_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_menu_intro_blocks_order (catalog_id, display_order),
  KEY idx_menu_intro_blocks_active (is_active),
  CONSTRAINT fk_menu_intro_blocks_catalog FOREIGN KEY (catalog_id) REFERENCES menu_catalogs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS menu_intro_bullets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  intro_block_id BIGINT UNSIGNED NOT NULL,
  bullet_text VARCHAR(255) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_menu_intro_bullets_order (intro_block_id, display_order),
  KEY idx_menu_intro_bullets_active (is_active),
  CONSTRAINT fk_menu_intro_bullets_block FOREIGN KEY (intro_block_id) REFERENCES menu_intro_blocks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS menu_sections (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  catalog_id BIGINT UNSIGNED NOT NULL,
  section_key VARCHAR(100) NOT NULL,
  section_type VARCHAR(50) NULL,
  title VARCHAR(255) NOT NULL,
  description VARCHAR(255) NULL,
  price VARCHAR(100) NULL,
  category VARCHAR(100) NULL,
  course_type VARCHAR(50) NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_menu_sections_key (section_key),
  UNIQUE KEY uq_menu_sections_catalog_order (catalog_id, display_order),
  KEY idx_menu_sections_active_order (is_active, display_order),
  CONSTRAINT fk_menu_sections_catalog FOREIGN KEY (catalog_id) REFERENCES menu_catalogs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS menu_section_columns (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  section_id BIGINT UNSIGNED NOT NULL,
  column_label VARCHAR(255) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_menu_section_columns_order (section_id, display_order),
  KEY idx_menu_section_columns_active (is_active),
  CONSTRAINT fk_menu_section_columns_section FOREIGN KEY (section_id) REFERENCES menu_sections(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS menu_section_rows (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  section_id BIGINT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  value_1 VARCHAR(100) NULL,
  value_2 VARCHAR(100) NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_menu_section_rows_item (section_id, item_id),
  UNIQUE KEY uq_menu_section_rows_order (section_id, display_order),
  KEY idx_menu_section_rows_active (is_active),
  CONSTRAINT fk_menu_section_rows_section FOREIGN KEY (section_id) REFERENCES menu_sections(id) ON DELETE CASCADE,
  CONSTRAINT fk_menu_section_rows_item FOREIGN KEY (item_id) REFERENCES menu_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS menu_section_include_groups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  section_id BIGINT UNSIGNED NOT NULL,
  group_id BIGINT UNSIGNED NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_menu_section_include_group (section_id, group_id),
  UNIQUE KEY uq_menu_section_include_order (section_id, display_order),
  KEY idx_menu_section_include_groups_active (is_active),
  CONSTRAINT fk_menu_section_include_groups_section FOREIGN KEY (section_id) REFERENCES menu_sections(id) ON DELETE CASCADE,
  CONSTRAINT fk_menu_section_include_groups_group FOREIGN KEY (group_id) REFERENCES menu_option_groups(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS menu_section_tiers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  section_id BIGINT UNSIGNED NOT NULL,
  tier_title VARCHAR(255) NOT NULL,
  price VARCHAR(100) NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_menu_section_tiers_order (section_id, display_order),
  KEY idx_menu_section_tiers_active (is_active),
  CONSTRAINT fk_menu_section_tiers_section FOREIGN KEY (section_id) REFERENCES menu_sections(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS menu_section_tier_constraints (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tier_id BIGINT UNSIGNED NOT NULL,
  constraint_key VARCHAR(100) NOT NULL,
  constraint_value INT NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_menu_section_tier_constraint (tier_id, constraint_key),
  KEY idx_menu_section_tier_constraints_active (is_active),
  CONSTRAINT fk_menu_section_tier_constraints_tier FOREIGN KEY (tier_id) REFERENCES menu_section_tiers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS menu_section_tier_bullets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tier_id BIGINT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NULL,
  bullet_text VARCHAR(255) NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_menu_section_tier_bullets_order (tier_id, display_order),
  KEY idx_menu_section_tier_bullets_active (is_active),
  CONSTRAINT fk_menu_section_tier_bullets_tier FOREIGN KEY (tier_id) REFERENCES menu_section_tiers(id) ON DELETE CASCADE,
  CONSTRAINT fk_menu_section_tier_bullets_item FOREIGN KEY (item_id) REFERENCES menu_items(id) ON DELETE SET NULL
);

INSERT INTO slides (title, caption, image_url, alt_text, display_order, is_active)
VALUES
  ('First slide label', 'Nulla vitae elit libero, a pharetra augue mollis interdum.', '/api/assets/slides/homeslider3.jpg', 'First slide', 1, 1),
  ('Second slide label', 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.', '/api/assets/slides/gratisography-cut-the-cake-800x525.jpg', 'Second slide', 2, 1),
  ('Third slide label', 'Praesent commodo cursus magna, vel scelerisque nisl consectetur.', '/api/assets/slides/gettyimages-1283712032-612x612.jpg', 'Third slide', 3, 1),
  ('Fourth slide label', 'Suscipit architecto veritatis quae sit distinctio corporis beatae?.', '/api/assets/slides/cooking-2132874_1280.jpg', 'Fourth slide', 4, 1),
  ('Fifth slide label', 'Eos, nisi sit, possimus maiores autem minima error eligendi repudiandae praesentium veritatis nam tempore modi vero maxime dolores perferendis aperiam? Necessitatibus, quas.', '/api/assets/slides/closeup-spaghetti-meatballs-tomato-sauce-260nw-2468747773.jpg', 'Fifth slide', 5, 1);
