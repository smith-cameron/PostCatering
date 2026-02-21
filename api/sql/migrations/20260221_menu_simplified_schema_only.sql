USE post_catering;

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
  UNIQUE KEY uq_formal_menu_groups_name (name),
  UNIQUE KEY uq_formal_menu_groups_key (`key`),
  KEY idx_formal_menu_groups_active_order (is_active, sort_order)
);

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
  KEY idx_formal_menu_items_active (is_active),
  KEY idx_formal_menu_items_group_id (group_id),
  KEY idx_formal_menu_items_active_group (is_active, group_id),
  CONSTRAINT fk_formal_menu_items_group FOREIGN KEY (group_id) REFERENCES formal_menu_groups(id) ON DELETE RESTRICT
);

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
