-- =============================================================
--  ModoShop S.A. — Esquema relacional (MySQL 8)
--  Ejecutar:  mysql -u root -p < database/schema.sql
-- =============================================================
CREATE DATABASE IF NOT EXISTS modoshop_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE modoshop_db;

SET FOREIGN_KEY_CHECKS = 0;
DROP VIEW IF EXISTS vw_available_products;
DROP PROCEDURE IF EXISTS sp_reserve_stock;
DROP TABLE IF EXISTS payments, order_items, orders, coupons, stock, product_variants, products, users, categories;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE categories (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  slug       VARCHAR(120) NOT NULL UNIQUE,
  parent_id  INT DEFAULT NULL,
  is_active  BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  email       VARCHAR(200) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  role        ENUM('CUSTOMER','ADMIN') DEFAULT 'CUSTOMER',
  phone       VARCHAR(30),
  address     TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE products (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(200) NOT NULL,
  description  TEXT,
  base_price   DECIMAL(10,2) NOT NULL,
  category_id  INT,
  brand        VARCHAR(100),
  images_json  JSON,                         -- array de URLs: ["url1","url2"]
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  INDEX idx_products_category (category_id),
  INDEX idx_products_active_price (is_active, base_price)
);

CREATE TABLE product_variants (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  product_id      INT NOT NULL,
  size            VARCHAR(20),                 -- XS, S, M, L, XL o numérico
  color           VARCHAR(50),
  sku             VARCHAR(80) NOT NULL UNIQUE,
  price_modifier  DECIMAL(8,2) DEFAULT 0.00,   -- suma o resta al base_price
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE stock (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  variant_id         INT NOT NULL UNIQUE,
  quantity           INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved_quantity  INT NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  last_updated       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE
);

CREATE TABLE coupons (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  code              VARCHAR(30) NOT NULL UNIQUE,
  type              ENUM('PERCENTAGE','FIXED') NOT NULL,
  value             DECIMAL(8,2) NOT NULL,
  min_order_amount  DECIMAL(10,2) DEFAULT 0,
  max_uses          INT DEFAULT NULL,           -- NULL = usos ilimitados
  used_count        INT DEFAULT 0,
  expires_at        DATETIME DEFAULT NULL,
  is_active         BOOLEAN DEFAULT TRUE,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  user_id           INT NOT NULL,
  coupon_id         INT DEFAULT NULL,
  status            ENUM('PENDING','PROCESSING','PAID','FAILED','CANCELLED','SHIPPED','DELIVERED') DEFAULT 'PENDING',
  subtotal          DECIMAL(10,2) NOT NULL,
  discount_amount   DECIMAL(10,2) DEFAULT 0.00,
  total             DECIMAL(10,2) NOT NULL,
  shipping_address  TEXT NOT NULL,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE SET NULL,
  INDEX idx_orders_user (user_id, created_at),
  INDEX idx_orders_status_date (status, created_at)
);

CREATE TABLE order_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  order_id    INT NOT NULL,
  variant_id  INT NOT NULL,
  quantity    INT NOT NULL CHECK (quantity > 0),
  unit_price  DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE RESTRICT
);

CREATE TABLE payments (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  order_id      INT NOT NULL UNIQUE,
  status        ENUM('PENDING','PROCESSING','PAID','FAILED','REFUNDED') DEFAULT 'PENDING',
  method        ENUM('CREDIT_CARD','DEBIT_CARD','TRANSFER','CASH') NOT NULL,
  amount        DECIMAL(10,2) NOT NULL,
  external_ref  VARCHAR(200),                   -- ID de transacción de la pasarela
  processed_at  DATETIME DEFAULT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- -------------------------------------------------------------
-- Vista: productos con stock disponible (no reservado)
-- -------------------------------------------------------------
CREATE VIEW vw_available_products AS
SELECT
  p.id,
  p.name,
  p.base_price,
  pv.id                                AS variant_id,
  pv.size,
  pv.color,
  pv.sku,
  (p.base_price + pv.price_modifier)   AS final_price,
  (s.quantity - s.reserved_quantity)   AS available_stock
FROM products p
JOIN product_variants pv ON p.id = pv.product_id
JOIN stock s             ON pv.id = s.variant_id
WHERE p.is_active = TRUE
  AND (s.quantity - s.reserved_quantity) > 0;

-- -------------------------------------------------------------
-- Stored Procedure: reservar stock al crear una orden
-- -------------------------------------------------------------
DELIMITER //
CREATE PROCEDURE sp_reserve_stock(IN p_variant_id INT, IN p_qty INT, OUT p_success BOOLEAN)
BEGIN
  DECLARE available INT DEFAULT 0;

  SELECT (quantity - reserved_quantity) INTO available
    FROM stock WHERE variant_id = p_variant_id FOR UPDATE;

  IF available >= p_qty THEN
    UPDATE stock SET reserved_quantity = reserved_quantity + p_qty
     WHERE variant_id = p_variant_id;
    SET p_success = TRUE;
  ELSE
    SET p_success = FALSE;
  END IF;
END //
DELIMITER ;
