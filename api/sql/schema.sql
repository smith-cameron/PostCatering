CREATE DATABASE IF NOT EXISTS post_catering;
USE post_catering;

CREATE TABLE IF NOT EXISTS slides (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(150) NULL,
  caption TEXT NULL,
  image_url VARCHAR(1024) NOT NULL,
  media_type ENUM('image', 'video') NOT NULL DEFAULT 'image',
  alt_text VARCHAR(255) NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_slide TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_slides_active_order (is_active, display_order),
  KEY idx_slides_active_flagged_order (is_active, is_slide, display_order),
  UNIQUE KEY uq_slides_image_url (image_url(191))
);

CREATE TABLE IF NOT EXISTS admin_users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(120) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(150) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_users_username (username)
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_user_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(64) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id VARCHAR(128) NULL,
  change_summary VARCHAR(255) NULL,
  before_json JSON NULL,
  after_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_admin_audit_created (created_at),
  KEY idx_admin_audit_entity (entity_type, entity_id),
  CONSTRAINT fk_admin_audit_user FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE
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

CREATE TABLE IF NOT EXISTS inquiry_selection_data (
  inquiry_id BIGINT UNSIGNED NOT NULL,
  service_selection_json JSON NULL,
  desired_menu_items_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (inquiry_id),
  CONSTRAINT fk_inquiry_selection_data_inquiry FOREIGN KEY (inquiry_id) REFERENCES inquiries(id) ON DELETE CASCADE
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

CREATE TABLE IF NOT EXISTS menu_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_key VARCHAR(128) NULL,
  item_name VARCHAR(255) NOT NULL,
  item_type VARCHAR(64) NULL,
  item_category VARCHAR(100) NULL,
  tray_price_half VARCHAR(100) NULL,
  tray_price_full VARCHAR(100) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_menu_items_name (item_name),
  UNIQUE KEY uq_menu_items_key (item_key),
  KEY idx_menu_items_active_category (is_active, item_category),
  KEY idx_menu_items_active_type (is_active, item_type)
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

-- Remove duplicate slide rows, keeping the earliest id per image_url.
DELETE s_dup
FROM slides s_dup
JOIN slides s_keep
  ON s_dup.image_url = s_keep.image_url
 AND s_dup.id > s_keep.id;

ALTER TABLE slides
  ADD UNIQUE KEY uq_slides_image_url (image_url(191));

UPDATE slides
SET title = 'placeholder title'
WHERE title IS NULL
   OR TRIM(title) = ''
   OR LOWER(TRIM(title)) REGEXP '(^|/)[^/]+\\.(jpg|jpeg|png|webp|gif|avif|mp4|webm|mov|m4v|ogv)$';

UPDATE slides
SET caption = 'placeholder text'
WHERE caption IS NULL
   OR TRIM(caption) = ''
   OR LOWER(TRIM(caption)) REGEXP '(^|/)[^/]+\\.(jpg|jpeg|png|webp|gif|avif|mp4|webm|mov|m4v|ogv)$';

UPDATE slides
SET alt_text = title
WHERE alt_text IS NULL
   OR TRIM(alt_text) = ''
   OR LOWER(TRIM(alt_text)) REGEXP '(^|/)[^/]+\\.(jpg|jpeg|png|webp|gif|avif|mp4|webm|mov|m4v|ogv)$';

INSERT INTO slides (title, caption, image_url, media_type, alt_text, display_order, is_slide, is_active)
SELECT
  src.title,
  src.caption,
  src.image_url,
  src.media_type,
  src.alt_text,
  src.display_order,
  src.is_slide,
  src.is_active
FROM (
  SELECT
    'First slide label' AS title,
    'Nulla vitae elit libero, a pharetra augue mollis interdum.' AS caption,
    '/api/assets/slides/20231114_152614.jpg' AS image_url,
    'image' AS media_type,
    'First slide' AS alt_text,
    1 AS display_order,
    1 AS is_slide,
    1 AS is_active
  UNION ALL
  SELECT
    'Second slide label',
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    '/api/assets/slides/123_1 (1).jpg',
    'image',
    'Second slide',
    2,
    1,
    1
  UNION ALL
  SELECT
    'Third slide label',
    'Praesent commodo cursus magna, vel scelerisque nisl consectetur.',
    '/api/assets/slides/20241128_171936.jpg',
    'image',
    'Third slide',
    3,
    1,
    1
  UNION ALL
  SELECT
    'Fourth slide label',
    'Suscipit architecto veritatis quae sit distinctio corporis beatae?.',
    '/api/assets/slides/20250106_173518.jpg',
    'image',
    'Fourth slide',
    4,
    1,
    1
  UNION ALL
  SELECT
    'Fifth slide label',
    'Eos, nisi sit, possimus maiores autem minima error eligendi repudiandae praesentium veritatis nam tempore modi vero maxime dolores perferendis aperiam? Necessitatibus, quas.',
    '/api/assets/slides/20250313_145844.jpg',
    'image',
    'Fifth slide',
    5,
    1,
    1
) src
LEFT JOIN slides existing ON existing.image_url = src.image_url
WHERE existing.id IS NULL;
