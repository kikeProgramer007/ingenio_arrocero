-- Datos genéricos de demostración para la tabla empresa.
-- No borra tablas. Seguro de ejecutar sobre db_royalalimentos / MariaDB existente.
--
-- En DBeaver: seleccionar esta base, abrir el archivo y Execute SQL Script.
-- En consola (ajusta usuario/host si hace falta):
--   mysql -h HOST -P 3306 -u USUARIO -p db_royalalimentos < backend/script_empresa_demo.sql

SET NAMES utf8mb4;

INSERT INTO empresa (
    nombre,
    nombre_corto,
    slogan,
    path_logo,
    formato_nota,
    tipo_cambio,
    created_at,
    updated_at
)
SELECT
    'Comercial Demo',
    'Empresa Demo',
    'Sistema de gestión comercial',
    '/uploads/defaults/logotipo.jpeg',
    '11',
    9.96,
    NOW(),
    NOW()
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM empresa LIMIT 1);

UPDATE empresa
SET
    nombre = 'Comercial Demo',
    nombre_corto = 'Empresa Demo',
    slogan = 'Sistema de gestión comercial',
    telefono = NULL,
    path_logo = '/uploads/defaults/logotipo.jpeg',
    updated_at = NOW();
