-- Schema alineado con los modelos Sequelize de backend/src/models
-- Base destino: test (TiDB Cloud / MySQL)
--
-- TiDB Cloud no acepta varias sentencias en un solo envío (error 8130).
-- En DBeaver NO selecciones el archivo y des Ctrl+Enter.
-- 1) Ejecutá primero SOLO esta línea (Ctrl+Enter):
--      SET SESSION tidb_multi_statement_mode = 'ON';
-- 2) Después: SQL Editor → Execute SQL Script (Alt+X), sin seleccionar texto.
-- Si sigue el 8130: click derecho en la conexión → Edit Connection →
-- Driver properties → allowMultiQueries = true → reconectá y repetí Alt+X.
--
-- DROP borra tablas previas de esta base; no toca otros schemas.
-- Después, creá el primer usuario con POST /api/users
-- { "username": "...", "password": "...", "id_perfil": 1 }

SET SESSION tidb_multi_statement_mode = 'ON';
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS `test` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `test`;

DROP TABLE IF EXISTS `acopios`;
DROP TABLE IF EXISTS `producciones`;
DROP TABLE IF EXISTS `campanas`;
DROP TABLE IF EXISTS `movimientos_inventario`;
DROP TABLE IF EXISTS `gastos`;
DROP TABLE IF EXISTS `pagos_proveedor`;
DROP TABLE IF EXISTS `compra_detalles`;
DROP TABLE IF EXISTS `compras`;
DROP TABLE IF EXISTS `cobranzas`;
DROP TABLE IF EXISTS `venta_detalles`;
DROP TABLE IF EXISTS `ventas`;
DROP TABLE IF EXISTS `movimientos_caja`;
DROP TABLE IF EXISTS `cajas`;
DROP TABLE IF EXISTS `productos`;
DROP TABLE IF EXISTS `categorias_producto`;
DROP TABLE IF EXISTS `clientes`;
DROP TABLE IF EXISTS `proveedores`;
DROP TABLE IF EXISTS `perfil_programas`;
DROP TABLE IF EXISTS `user`;
DROP TABLE IF EXISTS `usuarios`;
DROP TABLE IF EXISTS `programas`;
DROP TABLE IF EXISTS `perfil`;

-- ---------------------------------------------------------------------------
-- Acceso
-- ---------------------------------------------------------------------------

CREATE TABLE `perfil` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(100) NOT NULL,
    `eliminado` TINYINT(1) DEFAULT 0,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `programas` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_padre` INT NULL,
    `nombre_programa` VARCHAR(100) NOT NULL,
    `url` VARCHAR(255) NULL,
    `class_icon` VARCHAR(100) NULL,
    `es_expandible` TINYINT(1) DEFAULT 0,
    `nro_posicion` INT NULL,
    `eliminado` TINYINT(1) DEFAULT 0,
    PRIMARY KEY (`id`),
    CONSTRAINT `programas_id_padre_fk`
        FOREIGN KEY (`id_padre`) REFERENCES `programas` (`id`)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `perfil_programas` (
    `id_perfil` INT NOT NULL,
    `id_programa` INT NOT NULL,
    `permiso_lectura` TINYINT(1) DEFAULT 0,
    `permiso_escritura` TINYINT(1) DEFAULT 0,
    `permiso_modificacion` TINYINT(1) DEFAULT 0,
    PRIMARY KEY (`id_perfil`, `id_programa`),
    CONSTRAINT `perfil_programas_id_perfil_fk`
        FOREIGN KEY (`id_perfil`) REFERENCES `perfil` (`id`),
    CONSTRAINT `perfil_programas_id_programa_fk`
        FOREIGN KEY (`id_programa`) REFERENCES `programas` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `user` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(255) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `id_perfil` INT NULL,
    `eliminado` TINYINT(1) DEFAULT 0,
    `createdAt` DATETIME NOT NULL,
    `updatedAt` DATETIME NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `username` (`username`),
    CONSTRAINT `user_id_perfil_fk`
        FOREIGN KEY (`id_perfil`) REFERENCES `perfil` (`id`)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Maestros
-- ---------------------------------------------------------------------------

CREATE TABLE `categorias_producto` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(80) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `productos` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(150) NOT NULL,
    `descripcion` TEXT NULL,
    `precio_venta` DECIMAL(12,2) NOT NULL DEFAULT 0,
    `precio_compra` DECIMAL(12,2) NOT NULL DEFAULT 0,
    `stock` DECIMAL(12,3) NOT NULL DEFAULT 0,
    `stock_minimo` DECIMAL(12,3) NOT NULL DEFAULT 0,
    `unidad_medida` VARCHAR(30) NOT NULL DEFAULT 'kg',
    `path_imagen` VARCHAR(255) NULL DEFAULT '/uploads/defaults/producto.svg',
    `eliminado` TINYINT(1) DEFAULT 0,
    `id_categoria` INT NULL,
    `fecha_creacion` DATETIME NOT NULL,
    `fecha_modificacion` DATETIME NOT NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `productos_id_categoria_fk`
        FOREIGN KEY (`id_categoria`) REFERENCES `categorias_producto` (`id`)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `clientes` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(150) NOT NULL,
    `nit_ci` VARCHAR(30) NULL,
    `telefono` VARCHAR(30) NULL,
    `direccion` VARCHAR(250) NULL,
    `observacion` TEXT NULL,
    `activo` TINYINT(1) NOT NULL DEFAULT 1,
    `path_imagen` VARCHAR(255) NULL DEFAULT '/uploads/defaults/cliente.svg',
    `created_at` DATETIME NOT NULL,
    `updated_at` DATETIME NOT NULL,
    PRIMARY KEY (`id`),
    KEY `clientes_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `proveedores` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(150) NOT NULL,
    `nit_ci` VARCHAR(30) NULL,
    `telefono` VARCHAR(30) NULL,
    `direccion` VARCHAR(250) NULL,
    `observacion` TEXT NULL,
    `activo` TINYINT(1) NOT NULL DEFAULT 1,
    `path_imagen` VARCHAR(255) NULL DEFAULT '/uploads/defaults/proveedor.svg',
    `created_at` DATETIME NOT NULL,
    `updated_at` DATETIME NOT NULL,
    PRIMARY KEY (`id`),
    KEY `proveedores_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Caja
-- ---------------------------------------------------------------------------

CREATE TABLE `cajas` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `fecha_apertura` DATETIME NOT NULL,
    `fecha_cierre` DATETIME NULL,
    `saldo_inicial` DECIMAL(12,2) NOT NULL DEFAULT 0,
    `saldo_esperado` DECIMAL(12,2) NULL,
    `saldo_contado` DECIMAL(12,2) NULL,
    `diferencia` DECIMAL(12,2) NULL,
    `estado` VARCHAR(20) NOT NULL DEFAULT 'ABIERTA',
    `id_usuario_apertura` INT NOT NULL,
    `id_usuario_cierre` INT NULL,
    `observacion` TEXT NULL,
    `created_at` DATETIME NOT NULL,
    `updated_at` DATETIME NOT NULL,
    PRIMARY KEY (`id`),
    KEY `cajas_estado` (`estado`),
    CONSTRAINT `cajas_id_usuario_apertura_fk`
        FOREIGN KEY (`id_usuario_apertura`) REFERENCES `user` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT `cajas_id_usuario_cierre_fk`
        FOREIGN KEY (`id_usuario_cierre`) REFERENCES `user` (`id`)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `movimientos_caja` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_caja` INT NOT NULL,
    `tipo` VARCHAR(20) NOT NULL,
    `categoria` VARCHAR(40) NOT NULL,
    `concepto` VARCHAR(200) NOT NULL,
    `monto` DECIMAL(12,2) NOT NULL,
    `metodo_pago` VARCHAR(30) NOT NULL,
    `referencia` VARCHAR(100) NULL,
    `observacion` TEXT NULL,
    `origen` VARCHAR(40) NOT NULL DEFAULT 'MANUAL',
    `origen_id` INT NULL,
    `id_usuario` INT NOT NULL,
    `fecha` DATETIME NOT NULL,
    `created_at` DATETIME NOT NULL,
    `updated_at` DATETIME NOT NULL,
    PRIMARY KEY (`id`),
    KEY `movimientos_caja_id_caja_fecha` (`id_caja`, `fecha`),
    CONSTRAINT `movimientos_caja_id_caja_fk`
        FOREIGN KEY (`id_caja`) REFERENCES `cajas` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT `movimientos_caja_id_usuario_fk`
        FOREIGN KEY (`id_usuario`) REFERENCES `user` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Ventas
-- ---------------------------------------------------------------------------

CREATE TABLE `ventas` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_cliente` INT NOT NULL,
    `fecha` DATETIME NOT NULL,
    `total` DECIMAL(12,2) NOT NULL DEFAULT 0,
    `saldo_pendiente` DECIMAL(12,2) NOT NULL DEFAULT 0,
    `estado` VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    `observacion` TEXT NULL,
    `id_usuario` INT NOT NULL,
    `created_at` DATETIME NOT NULL,
    `updated_at` DATETIME NOT NULL,
    PRIMARY KEY (`id`),
    KEY `ventas_id_cliente` (`id_cliente`),
    KEY `ventas_estado` (`estado`),
    KEY `ventas_fecha` (`fecha`),
    CONSTRAINT `ventas_id_cliente_fk`
        FOREIGN KEY (`id_cliente`) REFERENCES `clientes` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT `ventas_id_usuario_fk`
        FOREIGN KEY (`id_usuario`) REFERENCES `user` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `venta_detalles` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_venta` INT NOT NULL,
    `descripcion` VARCHAR(200) NOT NULL,
    `id_producto` INT NULL,
    `cantidad` DECIMAL(12,3) NOT NULL,
    `precio_unitario` DECIMAL(12,2) NOT NULL,
    `subtotal` DECIMAL(12,2) NOT NULL,
    `created_at` DATETIME NOT NULL,
    `updated_at` DATETIME NOT NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `venta_detalles_id_venta_fk`
        FOREIGN KEY (`id_venta`) REFERENCES `ventas` (`id`)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT `venta_detalles_id_producto_fk`
        FOREIGN KEY (`id_producto`) REFERENCES `productos` (`id`)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `cobranzas` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_venta` INT NOT NULL,
    `id_cliente` INT NOT NULL,
    `id_caja` INT NOT NULL,
    `monto` DECIMAL(12,2) NOT NULL,
    `metodo_pago` VARCHAR(30) NOT NULL,
    `referencia` VARCHAR(100) NULL,
    `observacion` TEXT NULL,
    `fecha` DATETIME NOT NULL,
    `id_usuario` INT NOT NULL,
    `created_at` DATETIME NOT NULL,
    `updated_at` DATETIME NOT NULL,
    PRIMARY KEY (`id`),
    KEY `cobranzas_id_venta` (`id_venta`),
    KEY `cobranzas_id_cliente` (`id_cliente`),
    KEY `cobranzas_fecha` (`fecha`),
    CONSTRAINT `cobranzas_id_venta_fk`
        FOREIGN KEY (`id_venta`) REFERENCES `ventas` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT `cobranzas_id_cliente_fk`
        FOREIGN KEY (`id_cliente`) REFERENCES `clientes` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT `cobranzas_id_caja_fk`
        FOREIGN KEY (`id_caja`) REFERENCES `cajas` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT `cobranzas_id_usuario_fk`
        FOREIGN KEY (`id_usuario`) REFERENCES `user` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Compras
-- ---------------------------------------------------------------------------

CREATE TABLE `compras` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_proveedor` INT NOT NULL,
    `fecha` DATETIME NOT NULL,
    `total` DECIMAL(12,2) NOT NULL DEFAULT 0,
    `saldo_pendiente` DECIMAL(12,2) NOT NULL DEFAULT 0,
    `estado` VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    `observacion` TEXT NULL,
    `id_usuario` INT NOT NULL,
    `created_at` DATETIME NOT NULL,
    `updated_at` DATETIME NOT NULL,
    PRIMARY KEY (`id`),
    KEY `compras_id_proveedor` (`id_proveedor`),
    KEY `compras_estado` (`estado`),
    KEY `compras_fecha` (`fecha`),
    CONSTRAINT `compras_id_proveedor_fk`
        FOREIGN KEY (`id_proveedor`) REFERENCES `proveedores` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT `compras_id_usuario_fk`
        FOREIGN KEY (`id_usuario`) REFERENCES `user` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `compra_detalles` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_compra` INT NOT NULL,
    `descripcion` VARCHAR(200) NOT NULL,
    `id_producto` INT NULL,
    `cantidad` DECIMAL(12,3) NOT NULL,
    `precio_unitario` DECIMAL(12,2) NOT NULL,
    `subtotal` DECIMAL(12,2) NOT NULL,
    `created_at` DATETIME NOT NULL,
    `updated_at` DATETIME NOT NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `compra_detalles_id_compra_fk`
        FOREIGN KEY (`id_compra`) REFERENCES `compras` (`id`)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT `compra_detalles_id_producto_fk`
        FOREIGN KEY (`id_producto`) REFERENCES `productos` (`id`)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `pagos_proveedor` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_compra` INT NOT NULL,
    `id_proveedor` INT NOT NULL,
    `id_caja` INT NOT NULL,
    `monto` DECIMAL(12,2) NOT NULL,
    `metodo_pago` VARCHAR(30) NOT NULL,
    `referencia` VARCHAR(100) NULL,
    `observacion` TEXT NULL,
    `fecha` DATETIME NOT NULL,
    `id_usuario` INT NOT NULL,
    `created_at` DATETIME NOT NULL,
    `updated_at` DATETIME NOT NULL,
    PRIMARY KEY (`id`),
    KEY `pagos_proveedor_id_compra` (`id_compra`),
    KEY `pagos_proveedor_id_proveedor` (`id_proveedor`),
    KEY `pagos_proveedor_fecha` (`fecha`),
    CONSTRAINT `pagos_proveedor_id_compra_fk`
        FOREIGN KEY (`id_compra`) REFERENCES `compras` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT `pagos_proveedor_id_proveedor_fk`
        FOREIGN KEY (`id_proveedor`) REFERENCES `proveedores` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT `pagos_proveedor_id_caja_fk`
        FOREIGN KEY (`id_caja`) REFERENCES `cajas` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT `pagos_proveedor_id_usuario_fk`
        FOREIGN KEY (`id_usuario`) REFERENCES `user` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `gastos` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `tipo` VARCHAR(40) NOT NULL,
    `concepto` VARCHAR(200) NOT NULL,
    `categoria` VARCHAR(40) NULL,
    `monto` DECIMAL(12,2) NOT NULL,
    `metodo_pago` VARCHAR(30) NOT NULL,
    `referencia` VARCHAR(100) NULL,
    `observacion` TEXT NULL,
    `id_caja` INT NOT NULL,
    `fecha` DATETIME NOT NULL,
    `id_usuario` INT NOT NULL,
    `created_at` DATETIME NOT NULL,
    `updated_at` DATETIME NOT NULL,
    PRIMARY KEY (`id`),
    KEY `gastos_tipo` (`tipo`),
    KEY `gastos_fecha` (`fecha`),
    CONSTRAINT `gastos_id_caja_fk`
        FOREIGN KEY (`id_caja`) REFERENCES `cajas` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT `gastos_id_usuario_fk`
        FOREIGN KEY (`id_usuario`) REFERENCES `user` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `movimientos_inventario` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_producto` INT NOT NULL,
    `tipo` VARCHAR(20) NOT NULL,
    `cantidad` DECIMAL(12,3) NOT NULL,
    `stock_resultante` DECIMAL(12,3) NOT NULL,
    `origen` VARCHAR(40) NOT NULL,
    `origen_id` INT NULL,
    `observacion` TEXT NULL,
    `id_usuario` INT NOT NULL,
    `fecha` DATETIME NOT NULL,
    `created_at` DATETIME NOT NULL,
    `updated_at` DATETIME NOT NULL,
    PRIMARY KEY (`id`),
    KEY `movimientos_inventario_id_producto_fecha` (`id_producto`, `fecha`),
    CONSTRAINT `movimientos_inventario_id_producto_fk`
        FOREIGN KEY (`id_producto`) REFERENCES `productos` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT `movimientos_inventario_id_usuario_fk`
        FOREIGN KEY (`id_usuario`) REFERENCES `user` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Campañas / producción
-- ---------------------------------------------------------------------------

CREATE TABLE `campanas` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(150) NOT NULL,
    `fecha_inicio` DATE NOT NULL,
    `fecha_fin` DATE NULL,
    `meta_cantidad` DECIMAL(12,3) NULL,
    `estado` VARCHAR(20) NOT NULL DEFAULT 'ABIERTA',
    `observacion` TEXT NULL,
    `id_usuario` INT NOT NULL,
    `created_at` DATETIME NOT NULL,
    `updated_at` DATETIME NOT NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `campanas_id_usuario_fk`
        FOREIGN KEY (`id_usuario`) REFERENCES `user` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `acopios` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_campana` INT NOT NULL,
    `id_proveedor` INT NOT NULL,
    `id_producto` INT NULL,
    `descripcion` VARCHAR(200) NOT NULL,
    `cantidad` DECIMAL(12,3) NOT NULL,
    `precio_unitario` DECIMAL(12,2) NOT NULL,
    `total` DECIMAL(12,2) NOT NULL,
    `metodo_pago` VARCHAR(30) NULL,
    `pago` DECIMAL(12,2) NOT NULL DEFAULT 0,
    `id_caja` INT NULL,
    `observacion` TEXT NULL,
    `fecha` DATETIME NOT NULL,
    `id_usuario` INT NOT NULL,
    `created_at` DATETIME NOT NULL,
    `updated_at` DATETIME NOT NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `acopios_id_campana_fk`
        FOREIGN KEY (`id_campana`) REFERENCES `campanas` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT `acopios_id_proveedor_fk`
        FOREIGN KEY (`id_proveedor`) REFERENCES `proveedores` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT `acopios_id_producto_fk`
        FOREIGN KEY (`id_producto`) REFERENCES `productos` (`id`)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT `acopios_id_caja_fk`
        FOREIGN KEY (`id_caja`) REFERENCES `cajas` (`id`)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT `acopios_id_usuario_fk`
        FOREIGN KEY (`id_usuario`) REFERENCES `user` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `producciones` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `fecha` DATETIME NOT NULL,
    `id_producto_origen` INT NOT NULL,
    `cantidad_entrada` DECIMAL(12,3) NOT NULL,
    `id_producto_destino` INT NOT NULL,
    `cantidad_salida` DECIMAL(12,3) NOT NULL,
    `merma` DECIMAL(12,3) NOT NULL DEFAULT 0,
    `observacion` TEXT NULL,
    `id_usuario` INT NOT NULL,
    `created_at` DATETIME NOT NULL,
    `updated_at` DATETIME NOT NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `producciones_id_producto_origen_fk`
        FOREIGN KEY (`id_producto_origen`) REFERENCES `productos` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT `producciones_id_producto_destino_fk`
        FOREIGN KEY (`id_producto_destino`) REFERENCES `productos` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT `producciones_id_usuario_fk`
        FOREIGN KEY (`id_usuario`) REFERENCES `user` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------------
-- Seeds (programas-caja.seed.ts + inventario.seed.ts)
-- ---------------------------------------------------------------------------

INSERT INTO `perfil` (`id`, `nombre`, `eliminado`) VALUES
(1, 'Administrador', 0);

INSERT INTO `programas`
    (`id`, `id_padre`, `nombre_programa`, `url`, `class_icon`, `es_expandible`, `nro_posicion`, `eliminado`)
VALUES
(1,  NULL, 'Dashboard',              '/dashboard',         'pi pi-home',        0, 1,  0),
(2,  NULL, 'Ingresos y egresos',     '/ingresos-egresos',  'pi pi-arrows-h',    0, 10, 0),
(3,  NULL, 'Caja actual',            '/caja',              'pi pi-wallet',      0, 20, 0),
(4,  NULL, 'Historial de cajas',     '/caja/historial',    'pi pi-history',     0, 21, 0),
(5,  NULL, 'Clientes',               '/clientes',          'pi pi-users',       0, 30, 0),
(6,  NULL, 'Ventas',                 '/ventas',            'pi pi-shopping-cart', 0, 31, 0),
(7,  NULL, 'Cobranzas',              '/cobranzas',         'pi pi-money-bill',  0, 32, 0),
(8,  NULL, 'Proveedores',            '/proveedores',       'pi pi-truck',       0, 40, 0),
(9,  NULL, 'Compras',                '/compras',           'pi pi-box',         0, 41, 0),
(10, NULL, 'Pagos a proveedores',    '/pagos',             'pi pi-send',        0, 42, 0),
(11, NULL, 'Gastos de empresa',      '/gastos',            'pi pi-briefcase',   0, 50, 0),
(12, NULL, 'Retiros personales',     '/retiros',           'pi pi-user',        0, 51, 0),
(13, NULL, 'Inventario',             '/inventario',        'pi pi-th-large',    0, 60, 0),
(14, NULL, 'Campañas de acopio',     '/campanas',          'pi pi-sun',         0, 70, 0),
(15, NULL, 'Producción',             '/produccion',        'pi pi-cog',         0, 71, 0),
(16, NULL, 'Reportes',               '/reportes',          'pi pi-chart-bar',   0, 80, 0);

INSERT INTO `perfil_programas`
    (`id_perfil`, `id_programa`, `permiso_lectura`, `permiso_escritura`, `permiso_modificacion`)
VALUES
(1, 1,  1, 1, 1),
(1, 2,  1, 1, 1),
(1, 3,  1, 1, 1),
(1, 4,  1, 1, 1),
(1, 5,  1, 1, 1),
(1, 6,  1, 1, 1),
(1, 7,  1, 1, 1),
(1, 8,  1, 1, 1),
(1, 9,  1, 1, 1),
(1, 10, 1, 1, 1),
(1, 11, 1, 1, 1),
(1, 12, 1, 1, 1),
(1, 13, 1, 1, 1),
(1, 14, 1, 1, 1),
(1, 15, 1, 1, 1),
(1, 16, 1, 1, 1);

INSERT INTO `categorias_producto` (`id`, `nombre`) VALUES
(1, 'Arroz en chala'),
(2, 'Arroz pilado'),
(3, 'Insumos'),
(4, 'Empaque');

INSERT INTO `productos`
    (`id`, `nombre`, `descripcion`, `precio_venta`, `precio_compra`, `stock`, `stock_minimo`,
     `unidad_medida`, `path_imagen`, `eliminado`, `id_categoria`, `fecha_creacion`, `fecha_modificacion`)
VALUES
(1, 'Arroz en chala', 'Materia prima', 0, 0, 0, 0, 'kg', '/uploads/defaults/producto.svg', 0, 1, NOW(), NOW()),
(2, 'Arroz pilado', 'Producto terminado', 0, 0, 0, 0, 'kg', '/uploads/defaults/producto.svg', 0, 2, NOW(), NOW());
