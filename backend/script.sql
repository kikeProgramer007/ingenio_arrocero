CREATE TABLE perfil (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    eliminado BOOLEAN DEFAULT FALSE
);

CREATE TABLE programas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_padre INT NULL,
    nombre_programa VARCHAR(100) NOT NULL,
    url VARCHAR(255),
    class_icon VARCHAR(100),
    es_expandible BOOLEAN DEFAULT FALSE,
    nro_posicion INT,
    eliminado BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (id_padre) REFERENCES programas(id)
);

CREATE TABLE perfil_programas (
    id_perfil INT,
    id_programa INT,
    permiso_lectura BOOLEAN DEFAULT FALSE,
    permiso_escritura BOOLEAN DEFAULT FALSE,
    permiso_modificacion BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (id_perfil, id_programa),
    FOREIGN KEY (id_perfil) REFERENCES perfil(id),
    FOREIGN KEY (id_programa) REFERENCES programas(id)
);

CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    id_perfil INT,
    eliminado BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (id_perfil) REFERENCES perfil(id)
);


-- datos de prueba:
START TRANSACTION;

-- Desactivar temporalmente las restricciones de clave foránea
SET FOREIGN_KEY_CHECKS = 0;

-- Limpiar tablas (opcional, solo si necesitas reiniciar los datos)
-- TRUNCATE TABLE perfil_programas;
-- TRUNCATE TABLE programas;
-- TRUNCATE TABLE perfil;

-- Reactivar restricciones
SET FOREIGN_KEY_CHECKS = 1;

-- Insertar datos de perfil
INSERT INTO perfil (nombre, eliminado) VALUES
('Administrador', FALSE),
('Usuario Normal', FALSE),
('Invitado', FALSE),
('Auditor', FALSE),
('Eliminado', TRUE);

-- Insertar datos de programas
INSERT INTO programas (id_padre, nombre_programa, url, class_icon, es_expandible, nro_posicion, eliminado) VALUES
(NULL, 'Dashboard', '/dashboard', 'pi pi-home', FALSE, 1, FALSE),
(NULL, 'Administración', NULL, 'pi pi-cogs', TRUE, 2, FALSE),
(NULL, 'Reportes', NULL, 'pi pi-file-text', TRUE, 3, FALSE),
(NULL, 'Configuración', '/configuracion', 'pi pi-wrench', FALSE, 4, FALSE),
(NULL, 'Papelera', '/papelera', 'pi pi-trash', FALSE, 5, FALSE),
(2, 'Usuarios', '/admin/usuarios', 'pi pi-users', FALSE, 1, FALSE),
(2, 'Perfiles', '/admin/perfiles', 'pi pi-id-card', FALSE, 2, FALSE),
(2, 'Permisos', '/admin/permisos', 'pi pi-key', FALSE, 3, FALSE),
(2, 'Eliminados', '/admin/eliminados', 'pi pi-ban', FALSE, 4, FALSE),
(3, 'Ventas', '/pages/crud', 'pi pi-shopping-cart', FALSE, 1, FALSE),
(3, 'Inventario', '/reportes/inventario', 'pi pi-cubes', FALSE, 2, FALSE),
(3, 'Auditoría', '/reportes/auditoria', 'pi pi-search', FALSE, 3, FALSE),
(NULL, 'Pruebas', '/pruebas', 'pi pi-flask', FALSE, 6, TRUE);

-- Insertar permisos
INSERT INTO perfil_programas (id_perfil, id_programa, permiso_lectura, permiso_escritura, permiso_modificacion) VALUES
-- Administrador
(1, 1, TRUE, TRUE, TRUE),
(1, 2, TRUE, TRUE, TRUE),
(1, 3, TRUE, TRUE, TRUE),
(1, 4, TRUE, TRUE, TRUE),
(1, 5, TRUE, TRUE, TRUE),
(1, 6, TRUE, TRUE, TRUE),
(1, 7, TRUE, TRUE, TRUE),
(1, 8, TRUE, TRUE, TRUE),
(1, 9, TRUE, TRUE, TRUE),
(1, 10, TRUE, TRUE, TRUE),
(1, 11, TRUE, TRUE, TRUE),
-- Usuario Normal
(2, 1, TRUE, FALSE, FALSE),
(2, 3, TRUE, FALSE, FALSE),
(2, 9, TRUE, FALSE, FALSE),
(2, 10, TRUE, FALSE, FALSE),
-- Invitado
(3, 1, TRUE, FALSE, FALSE),
(3, 9, TRUE, FALSE, FALSE),
-- Auditor
(4, 1, TRUE, FALSE, FALSE),
(4, 2, TRUE, FALSE, FALSE),
(4, 3, TRUE, FALSE, FALSE),
(4, 4, TRUE, FALSE, FALSE),
(4, 5, TRUE, FALSE, FALSE),
(4, 6, TRUE, FALSE, FALSE),
(4, 7, TRUE, FALSE, FALSE),
(4, 8, TRUE, FALSE, FALSE),
(4, 9, TRUE, FALSE, FALSE),
(4, 10, TRUE, FALSE, FALSE),
(4, 11, TRUE, FALSE, FALSE);

COMMIT;