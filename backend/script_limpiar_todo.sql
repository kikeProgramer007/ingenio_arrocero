-- Limpia todas las tablas EXCEPTO usuarios y empresa.
-- No toca: user, empresa, perfil, programas, perfil_programas
-- (perfil/menú se dejan porque cada usuario apunta a un perfil; si se borran, no entra al sistema).
--
-- Tras vaciar clientes, inserta un solo registro: Público en general (id 1).
--
-- Usa DELETE (no TRUNCATE) para no exigir privilegio DROP.
-- DBeaver: seleccionar la base y Execute SQL Script (Alt+X).
-- NO ejecutar si hay datos que quieras conservar.

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
DELETE FROM `categorias_egreso`;
DELETE FROM `productores`;
DELETE FROM `proveedores`;
DELETE FROM `clientes`;
DELETE FROM `productos`;
DELETE FROM `categorias_producto`;

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
ALTER TABLE `categorias_egreso` AUTO_INCREMENT = 1;
ALTER TABLE `productores` AUTO_INCREMENT = 1;
ALTER TABLE `proveedores` AUTO_INCREMENT = 1;
ALTER TABLE `clientes` AUTO_INCREMENT = 1;
ALTER TABLE `productos` AUTO_INCREMENT = 1;
ALTER TABLE `categorias_producto` AUTO_INCREMENT = 1;

SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO `clientes` (
    id, nombre, nit_ci, telefono, direccion, procedencia, observacion, activo, path_imagen, created_at, updated_at
) VALUES (
    1,
    'Público en general',
    '000000000',
    '70000000',
    'Mostrador / venta al contado',
    'Local',
    'Cliente de mostrador para ventas sin ficha particular.',
    1,
    '/uploads/defaults/cliente.svg',
    NOW(),
    NOW()
);

ALTER TABLE `clientes` AUTO_INCREMENT = 2;
