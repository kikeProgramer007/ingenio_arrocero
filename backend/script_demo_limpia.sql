-- Base de presentación limpia (MariaDB).
-- Conserva: usuarios, perfiles, menú, empresa, categorías y productos de inventario.
-- Vacía: ventas, compras, despachos, caja, ingresos, egresos y kardex.
-- Luego deja 5 clientes (id 1 = Público en general) y 3 proveedores. Sin la palabra DEMO.
--
-- Usa DELETE (no TRUNCATE) porque el usuario de aplicación suele no tener DROP.
--
-- DBeaver: seleccionar la base, abrir este archivo y Execute SQL Script (Alt+X).
-- Consola:
--   mysql -h HOST -P 3306 -u USUARIO -p NOMBRE_BASE < backend/script_demo_limpia.sql

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DELETE FROM `cobranzas`;
DELETE FROM `bitacora_ventas`;
DELETE FROM `venta_detalles`;
DELETE FROM `despachos`;
DELETE FROM `reservas_venta`;
DELETE FROM `reservas_producto`;
DELETE FROM `ventas_entrega`;
DELETE FROM `ventas`;
DELETE FROM `pagos_proveedor`;
DELETE FROM `recepciones_compra`;
DELETE FROM `compra_detalles`;
DELETE FROM `compras`;
DELETE FROM `pagos_gasto`;
DELETE FROM `gastos`;
DELETE FROM `acopios`;
DELETE FROM `campanas`;
DELETE FROM `producciones`;
DELETE FROM `movimientos_inventario`;
DELETE FROM `arqueos_caja`;
DELETE FROM `movimientos_caja`;
DELETE FROM `cajas`;
DELETE FROM `beneficiarios`;
DELETE FROM `productores`;
DELETE FROM `proveedores`;
DELETE FROM `clientes`;

ALTER TABLE `cobranzas` AUTO_INCREMENT = 1;
ALTER TABLE `bitacora_ventas` AUTO_INCREMENT = 1;
ALTER TABLE `venta_detalles` AUTO_INCREMENT = 1;
ALTER TABLE `despachos` AUTO_INCREMENT = 1;
ALTER TABLE `reservas_venta` AUTO_INCREMENT = 1;
ALTER TABLE `reservas_producto` AUTO_INCREMENT = 1;
ALTER TABLE `ventas_entrega` AUTO_INCREMENT = 1;
ALTER TABLE `ventas` AUTO_INCREMENT = 1;
ALTER TABLE `pagos_proveedor` AUTO_INCREMENT = 1;
ALTER TABLE `recepciones_compra` AUTO_INCREMENT = 1;
ALTER TABLE `compra_detalles` AUTO_INCREMENT = 1;
ALTER TABLE `compras` AUTO_INCREMENT = 1;
ALTER TABLE `pagos_gasto` AUTO_INCREMENT = 1;
ALTER TABLE `gastos` AUTO_INCREMENT = 1;
ALTER TABLE `acopios` AUTO_INCREMENT = 1;
ALTER TABLE `campanas` AUTO_INCREMENT = 1;
ALTER TABLE `producciones` AUTO_INCREMENT = 1;
ALTER TABLE `movimientos_inventario` AUTO_INCREMENT = 1;
ALTER TABLE `arqueos_caja` AUTO_INCREMENT = 1;
ALTER TABLE `movimientos_caja` AUTO_INCREMENT = 1;
ALTER TABLE `cajas` AUTO_INCREMENT = 1;
ALTER TABLE `beneficiarios` AUTO_INCREMENT = 1;
ALTER TABLE `productores` AUTO_INCREMENT = 1;
ALTER TABLE `proveedores` AUTO_INCREMENT = 1;
ALTER TABLE `clientes` AUTO_INCREMENT = 1;

SET FOREIGN_KEY_CHECKS = 1;

UPDATE `productos`
SET
    stock = 1000,
    fecha_modificacion = NOW()
WHERE COALESCE(eliminado, 0) = 0
  AND COALESCE(disponible_en, 'AMBOS') IN ('VENTAS', 'AMBOS');

UPDATE `productos`
SET
    stock = 0,
    fecha_modificacion = NOW()
WHERE COALESCE(eliminado, 0) = 0
  AND disponible_en = 'COMPRAS';

INSERT INTO `clientes` (
    id, nombre, nit_ci, telefono, direccion, observacion, activo, path_imagen, created_at, updated_at
) VALUES
(1, 'Público en general', NULL, NULL, NULL, NULL, 1, '/uploads/defaults/cliente.svg', NOW(), NOW()),
(2, 'Adelia Terceros', NULL, '77123456', 'Santa Cruz', NULL, 1, '/uploads/defaults/cliente.svg', NOW(), NOW()),
(3, 'Ana María Tapia', NULL, '77234567', 'Santa Cruz', NULL, 1, '/uploads/defaults/cliente.svg', NOW(), NOW()),
(4, 'Aurora Escobar', NULL, '77345678', 'Montero', NULL, 1, '/uploads/defaults/cliente.svg', NOW(), NOW()),
(5, 'Bruno Aponte', NULL, '77456789', 'Warnes', NULL, 1, '/uploads/defaults/cliente.svg', NOW(), NOW());

INSERT INTO `proveedores` (
    id, nombre, nit_ci, telefono, direccion, observacion, activo, path_imagen, created_at, updated_at
) VALUES
(1, 'Shinken Takara', NULL, '77654321', 'Santa Cruz', NULL, 1, '/uploads/defaults/proveedor.svg', NOW(), NOW()),
(2, 'Yasushi Nakamura', NULL, '77543210', 'San Juan', NULL, 1, '/uploads/defaults/proveedor.svg', NOW(), NOW()),
(3, 'Salvador Orellana', NULL, '77432109', 'Mineros', NULL, 1, '/uploads/defaults/proveedor.svg', NOW(), NOW());

ALTER TABLE `clientes` AUTO_INCREMENT = 6;
ALTER TABLE `proveedores` AUTO_INCREMENT = 4;

SELECT 'clientes' AS tabla, COUNT(*) AS filas FROM clientes
UNION ALL SELECT 'proveedores', COUNT(*) FROM proveedores
UNION ALL SELECT 'productos', COUNT(*) FROM productos
UNION ALL SELECT 'productos_venta_con_stock', COUNT(*) FROM productos
    WHERE COALESCE(eliminado, 0) = 0 AND COALESCE(disponible_en, 'AMBOS') IN ('VENTAS', 'AMBOS') AND stock >= 1000
UNION ALL SELECT 'ventas', COUNT(*) FROM ventas
UNION ALL SELECT 'compras', COUNT(*) FROM compras
UNION ALL SELECT 'gastos', COUNT(*) FROM gastos
UNION ALL SELECT 'cajas', COUNT(*) FROM cajas
UNION ALL SELECT 'movimientos_caja', COUNT(*) FROM movimientos_caja
UNION ALL SELECT 'user', COUNT(*) FROM user;
