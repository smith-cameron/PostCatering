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
  KEY idx_slides_active_order (is_active, display_order)
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

INSERT INTO slides (title, caption, image_url, alt_text, display_order, is_active)
VALUES
  ('First slide label', 'Nulla vitae elit libero, a pharetra augue mollis interdum.', '/imgs/homeslider3.jpg', 'First slide', 1, 1),
  ('Second slide label', 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.', '/imgs/gratisography-cut-the-cake-800x525.jpg', 'Second slide', 2, 1),
  ('Third slide label', 'Praesent commodo cursus magna, vel scelerisque nisl consectetur.', '/imgs/gettyimages-1283712032-612x612.jpg', 'Third slide', 3, 1),
  ('Fourth slide label', 'Suscipit architecto veritatis quae sit distinctio corporis beatae?.', '/imgs/cooking-2132874_1280.jpg', 'Fourth slide', 4, 1),
  ('Fifth slide label', 'Eos, nisi sit, possimus maiores autem minima error eligendi repudiandae praesentium veritatis nam tempore modi vero maxime dolores perferendis aperiam? Necessitatibus, quas.', '/imgs/closeup-spaghetti-meatballs-tomato-sauce-260nw-2468747773.jpg', 'Fifth slide', 5, 1);
