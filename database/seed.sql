-- =============================================================
--  ModoShop S.A. — Datos de prueba
--  Ejecutar después de schema.sql:  mysql -u root -p < database/seed.sql
--
--  Usuarios de prueba:
--    admin@modoshop.com   / Admin1234    (ADMIN)
--    lucia@modoshop.com   / Cliente1234  (CUSTOMER)
--    martin@modoshop.com  / Cliente1234  (CUSTOMER)
-- =============================================================
USE modoshop_db;

INSERT INTO categories (id, name, slug, parent_id) VALUES
  (1, 'Ropa',        'ropa',        NULL),
  (2, 'Remeras',     'remeras',     1),
  (3, 'Pantalones',  'pantalones',  1),
  (4, 'Buzos',       'buzos',       1),
  (5, 'Calzado',     'calzado',     NULL),
  (6, 'Zapatillas',  'zapatillas',  5),
  (7, 'Accesorios',  'accesorios',  NULL);

INSERT INTO users (id, name, email, password, role, phone, address) VALUES
  (1, 'Admin ModoShop', 'admin@modoshop.com',  '$2b$10$6Ns9Ks7vHCM/MTV.Os6jwOnDf7xKE6vJsw.UPLiGKa59Xb6miK.oG', 'ADMIN',    '+54 11 4000-0000', 'Av. Corrientes 1234, CABA'),
  (2, 'Lucía Gómez',    'lucia@modoshop.com',  '$2b$10$wCgEZ6U9LvOU/9CUTKhz0ewdXh6CSlfHVhRIO7vCq7/DPDt.TZJUS', 'CUSTOMER', '+54 11 5555-1111', 'Calle Falsa 123, Palermo, CABA'),
  (3, 'Martín Pérez',   'martin@modoshop.com', '$2b$10$wCgEZ6U9LvOU/9CUTKhz0ewdXh6CSlfHVhRIO7vCq7/DPDt.TZJUS', 'CUSTOMER', '+54 11 5555-2222', 'Av. Santa Fe 4321, CABA');

INSERT INTO products (id, name, description, base_price, category_id, brand, images_json) VALUES
  (1, 'Remera Oversize Básica', 'Remera de algodón peinado 24/1, calce oversize.', 4500.00, 2, 'Modo Basics', JSON_ARRAY('https://picsum.photos/seed/remera/600/800')),
  (2, 'Jean Mom Fit',            'Jean rígido tiro alto, lavado clásico.',          18900.00, 3, 'Denim Co',    JSON_ARRAY('https://picsum.photos/seed/jean/600/800')),
  (3, 'Buzo Canguro Frisa',      'Buzo con capucha y bolsillo canguro.',            15500.00, 4, 'Modo Basics', JSON_ARRAY('https://picsum.photos/seed/buzo/600/800')),
  (4, 'Zapatillas Urban Run',    'Zapatillas urbanas con suela de goma.',           32000.00, 6, 'Runners',     JSON_ARRAY('https://picsum.photos/seed/zapa/600/800')),
  (5, 'Gorra Trucker',           'Gorra con malla trasera y broche regulable.',      6200.00, 7, 'Modo Basics', JSON_ARRAY('https://picsum.photos/seed/gorra/600/800')),
  (6, 'Remera Edición Limitada', 'Última unidad: ideal para probar concurrencia.',   9900.00, 2, 'Modo Lab',    JSON_ARRAY('https://picsum.photos/seed/limited/600/800'));

INSERT INTO product_variants (id, product_id, size, color, sku, price_modifier) VALUES
  (101, 1, 'S',  'Negro',  'REM-OVS-S-NEG',  0.00),
  (102, 1, 'M',  'Negro',  'REM-OVS-M-NEG',  0.00),
  (103, 1, 'L',  'Blanco', 'REM-OVS-L-BLA',  0.00),
  (104, 1, 'XL', 'Blanco', 'REM-OVS-XL-BLA', 500.00),
  (201, 2, '38', 'Azul',   'JEA-MOM-38-AZU', 0.00),
  (202, 2, '40', 'Azul',   'JEA-MOM-40-AZU', 0.00),
  (203, 2, '42', 'Negro',  'JEA-MOM-42-NEG', 1000.00),
  (301, 3, 'M',  'Gris',   'BUZ-CAN-M-GRI',  0.00),
  (302, 3, 'L',  'Verde',  'BUZ-CAN-L-VER',  0.00),
  (401, 4, '40', 'Blanco', 'ZAP-URB-40-BLA', 0.00),
  (402, 4, '42', 'Negro',  'ZAP-URB-42-NEG', 0.00),
  (501, 5, 'U',  'Negro',  'GOR-TRU-U-NEG',  0.00),
  (601, 6, 'M',  'Rojo',   'REM-LIM-M-ROJ',  0.00);

INSERT INTO stock (variant_id, quantity, reserved_quantity) VALUES
  (101, 25, 0), (102, 40, 0), (103, 30, 0), (104, 10, 0),
  (201, 15, 0), (202, 12, 0), (203, 0, 0),
  (301, 20, 0), (302, 8, 0),
  (401, 10, 0), (402, 5, 0),
  (501, 50, 0),
  (601, 1, 0);   -- 1 unidad para el Flujo 2 (control de stock concurrente)

INSERT INTO coupons (code, type, value, min_order_amount, max_uses, used_count, expires_at, is_active) VALUES
  ('WELCOME10', 'PERCENTAGE', 10.00,     0.00, NULL, 0, DATE_ADD(NOW(), INTERVAL 1 YEAR), TRUE),
  ('ENVIO5000', 'FIXED',    5000.00, 30000.00, 100,  0, DATE_ADD(NOW(), INTERVAL 6 MONTH), TRUE),
  ('VERANO25',  'PERCENTAGE', 25.00, 20000.00, 2,    2, DATE_ADD(NOW(), INTERVAL 1 MONTH), TRUE),  -- límite de usos alcanzado
  ('EXPIRADO',  'PERCENTAGE', 15.00,     0.00, NULL, 0, '2024-01-01 00:00:00', TRUE),              -- vencido
  ('INACTIVO',  'FIXED',      1000.00,   0.00, NULL, 0, NULL, FALSE);                              -- desactivado
