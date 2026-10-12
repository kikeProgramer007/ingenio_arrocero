import { QueryTypes } from 'sequelize';
import { sequelize } from '../models';

type ColumnRow = { Field: string; Null: string };

export async function asegurarEsquemaGastos(): Promise<void> {
    const columnas = await sequelize.query<ColumnRow>('SHOW COLUMNS FROM gastos', {
        type: QueryTypes.SELECT
    });
    const porNombre = new Map(columnas.map((col) => [col.Field, col]));

    if (!porNombre.has('descontar_caja')) {
        await sequelize.query(
            'ALTER TABLE gastos ADD COLUMN descontar_caja TINYINT(1) NOT NULL DEFAULT 1'
        );
    }

    const faltantes: { nombre: string; ddl: string }[] = [
        { nombre: 'persona', ddl: 'ADD COLUMN persona VARCHAR(120) NULL' },
        { nombre: 'condicion', ddl: "ADD COLUMN condicion VARCHAR(10) NOT NULL DEFAULT 'CONTADO'" },
        { nombre: 'saldo_pendiente', ddl: 'ADD COLUMN saldo_pendiente DECIMAL(12,2) NOT NULL DEFAULT 0' },
        { nombre: 'estado', ddl: "ADD COLUMN estado VARCHAR(20) NOT NULL DEFAULT 'PAGADO'" },
        { nombre: 'plazo_dias', ddl: 'ADD COLUMN plazo_dias INT NULL' },
        { nombre: 'fecha_vencimiento', ddl: 'ADD COLUMN fecha_vencimiento DATE NULL' }
    ];
    for (const col of faltantes) {
        if (!porNombre.has(col.nombre)) {
            await sequelize.query(`ALTER TABLE gastos ${col.ddl}`);
        }
    }

    const idCaja = porNombre.get('id_caja');
    if (idCaja && String(idCaja.Null).toUpperCase() === 'NO') {
        await sequelize.query('ALTER TABLE gastos MODIFY COLUMN id_caja INT NULL');
    }
}

/** Amortizaciones de gastos a crédito. Se crea aquí porque el sync de TiDB puede abortar. */
export async function asegurarEsquemaPagosGasto(): Promise<void> {
    await sequelize.query(`
        CREATE TABLE IF NOT EXISTS pagos_gasto (
            id INT NOT NULL AUTO_INCREMENT,
            id_gasto INT NOT NULL,
            id_caja INT NOT NULL,
            monto DECIMAL(12,2) NOT NULL,
            metodo_pago VARCHAR(30) NOT NULL,
            monto_efectivo DECIMAL(12,2) NULL,
            monto_qr DECIMAL(12,2) NULL,
            referencia VARCHAR(100) NULL,
            observacion TEXT NULL,
            fecha DATETIME NOT NULL,
            id_usuario INT NOT NULL,
            created_at DATETIME NULL,
            updated_at DATETIME NULL,
            PRIMARY KEY (id),
            KEY pagos_gasto_id_gasto (id_gasto),
            KEY pagos_gasto_fecha (fecha)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
}

const TABLAS_PAGO_MIXTO: { tabla: string; columnaMonto: string }[] = [
    { tabla: 'cobranzas', columnaMonto: 'monto' },
    { tabla: 'pagos_proveedor', columnaMonto: 'monto' },
    { tabla: 'gastos', columnaMonto: 'monto' },
    { tabla: 'acopios', columnaMonto: 'pago' }
];

export async function asegurarEsquemaPagoMixto(): Promise<void> {
    for (const { tabla, columnaMonto } of TABLAS_PAGO_MIXTO) {
        const existe = await sequelize.query<{ c: number }>(
            'SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :tabla',
            { replacements: { tabla }, type: QueryTypes.SELECT }
        );
        if (!Number(existe[0]?.c)) {
            continue;
        }

        const columnas = await sequelize.query<ColumnRow>(`SHOW COLUMNS FROM \`${tabla}\``, {
            type: QueryTypes.SELECT
        });
        const nombres = new Set(columnas.map((col) => col.Field));
        for (const col of ['monto_efectivo', 'monto_qr']) {
            if (!nombres.has(col)) {
                await sequelize.query(`ALTER TABLE \`${tabla}\` ADD COLUMN \`${col}\` DECIMAL(12,2) NULL`);
                nombres.add(col);
            }
        }
        if (!nombres.has(columnaMonto) || !nombres.has('metodo_pago')) {
            continue;
        }
        await sequelize.query(
            `UPDATE \`${tabla}\` SET monto_efectivo = \`${columnaMonto}\`, monto_qr = 0 WHERE metodo_pago = 'EFECTIVO' AND monto_efectivo IS NULL`
        );
        await sequelize.query(
            `UPDATE \`${tabla}\` SET monto_efectivo = 0, monto_qr = \`${columnaMonto}\` WHERE metodo_pago <> 'EFECTIVO' AND metodo_pago <> 'MIXTO' AND monto_qr IS NULL`
        );
    }
}

export async function asegurarEsquemaVentas(): Promise<void> {
    const columnas = await sequelize.query<ColumnRow>('SHOW COLUMNS FROM ventas', {
        type: QueryTypes.SELECT
    });
    const nombres = new Set(columnas.map((col) => col.Field));
    if (!nombres.has('plazo_dias')) {
        await sequelize.query('ALTER TABLE ventas ADD COLUMN plazo_dias INT NULL');
    }
    if (!nombres.has('fecha_vencimiento')) {
        await sequelize.query('ALTER TABLE ventas ADD COLUMN fecha_vencimiento DATE NULL');
    }
}

export async function asegurarEsquemaClientes(): Promise<void> {
    const columnas = await sequelize.query<ColumnRow>('SHOW COLUMNS FROM clientes', {
        type: QueryTypes.SELECT
    });
    const nombres = new Set(columnas.map((col) => col.Field));
    if (!nombres.has('procedencia')) {
        await sequelize.query('ALTER TABLE clientes ADD COLUMN procedencia VARCHAR(40) NULL');
    }
}

export async function asegurarEsquemaEmpresa(): Promise<void> {
    await sequelize.query(`
        CREATE TABLE IF NOT EXISTS empresa (
            id INT NOT NULL AUTO_INCREMENT,
            nombre VARCHAR(150) NOT NULL,
            nombre_corto VARCHAR(80) NULL,
            slogan VARCHAR(150) NULL,
            titular VARCHAR(150) NULL,
            nit VARCHAR(30) NULL,
            direccion VARCHAR(250) NULL,
            telefono VARCHAR(80) NULL,
            ciudad VARCHAR(80) NULL,
            email VARCHAR(120) NULL,
            path_logo VARCHAR(255) NULL,
            created_at DATETIME NULL,
            updated_at DATETIME NULL,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    const columnas = await sequelize.query<ColumnRow>('SHOW COLUMNS FROM empresa', {
        type: QueryTypes.SELECT
    });
    const nombres = new Set(columnas.map((col) => col.Field));
    const faltantes: { nombre: string; ddl: string }[] = [
        { nombre: 'nombre_corto', ddl: 'ADD COLUMN nombre_corto VARCHAR(80) NULL' },
        { nombre: 'slogan', ddl: 'ADD COLUMN slogan VARCHAR(150) NULL' },
        { nombre: 'titular', ddl: 'ADD COLUMN titular VARCHAR(150) NULL' },
        { nombre: 'nit', ddl: 'ADD COLUMN nit VARCHAR(30) NULL' },
        { nombre: 'direccion', ddl: 'ADD COLUMN direccion VARCHAR(250) NULL' },
        { nombre: 'telefono', ddl: 'ADD COLUMN telefono VARCHAR(80) NULL' },
        { nombre: 'ciudad', ddl: 'ADD COLUMN ciudad VARCHAR(80) NULL' },
        { nombre: 'email', ddl: 'ADD COLUMN email VARCHAR(120) NULL' },
        { nombre: 'path_logo', ddl: 'ADD COLUMN path_logo VARCHAR(255) NULL' },
        { nombre: 'formato_nota', ddl: "ADD COLUMN formato_nota VARCHAR(8) NULL" },
        { nombre: 'tipo_cambio', ddl: 'ADD COLUMN tipo_cambio DECIMAL(12,4) NOT NULL DEFAULT 9.96' }
    ];
    for (const col of faltantes) {
        if (!nombres.has(col.nombre)) {
            await sequelize.query(`ALTER TABLE empresa ${col.ddl}`);
        }
    }
}

export async function asegurarEsquemaCompras(): Promise<void> {
    const columnas = await sequelize.query<ColumnRow>('SHOW COLUMNS FROM compras', {
        type: QueryTypes.SELECT
    });
    const nombres = new Set(columnas.map((col) => col.Field));
    const faltantes: { nombre: string; ddl: string }[] = [
        { nombre: 'boleta', ddl: 'ADD COLUMN boleta VARCHAR(40) NULL' },
        { nombre: 'chofer', ddl: 'ADD COLUMN chofer VARCHAR(120) NULL' },
        { nombre: 'placa', ddl: 'ADD COLUMN placa VARCHAR(30) NULL' },
        { nombre: 'fanegas', ddl: 'ADD COLUMN fanegas DECIMAL(12,3) NULL' },
        { nombre: 'concepto', ddl: 'ADD COLUMN concepto VARCHAR(40) NULL' },
        { nombre: 'tipo_compra', ddl: 'ADD COLUMN tipo_compra VARCHAR(20) NULL' },
        { nombre: 'tipo_cambio', ddl: 'ADD COLUMN tipo_cambio DECIMAL(12,4) NULL' },
        { nombre: 'total_usd', ddl: 'ADD COLUMN total_usd DECIMAL(12,2) NULL' },
        { nombre: 'precio_usd', ddl: 'ADD COLUMN precio_usd DECIMAL(12,4) NULL' },
        { nombre: 'id_productor', ddl: 'ADD COLUMN id_productor INT NULL' },
        { nombre: 'plazo_dias', ddl: 'ADD COLUMN plazo_dias INT NULL' },
        { nombre: 'fecha_vencimiento', ddl: 'ADD COLUMN fecha_vencimiento DATE NULL' }
    ];
    for (const col of faltantes) {
        if (!nombres.has(col.nombre)) {
            await sequelize.query(`ALTER TABLE compras ${col.ddl}`);
        }
    }

    const detallesExiste = await sequelize.query<{ c: number }>(
        "SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'compra_detalles'",
        { type: QueryTypes.SELECT }
    );
    if (Number(detallesExiste[0]?.c)) {
        const columnasDet = await sequelize.query<ColumnRow>('SHOW COLUMNS FROM compra_detalles', {
            type: QueryTypes.SELECT
        });
        const nombresDet = new Set(columnasDet.map((col) => col.Field));
        if (!nombresDet.has('unidad')) {
            await sequelize.query('ALTER TABLE compra_detalles ADD COLUMN unidad VARCHAR(20) NULL');
        }
    }
}

/** Separa productores de proveedores: tabla propia y FK de compras.id_productor. */
export async function asegurarEsquemaProductores(): Promise<void> {
    await sequelize.query(`
        CREATE TABLE IF NOT EXISTS productores (
            id INT NOT NULL AUTO_INCREMENT,
            nombre VARCHAR(150) NOT NULL,
            nit_ci VARCHAR(30) NULL,
            telefono VARCHAR(30) NULL,
            direccion VARCHAR(250) NULL,
            observacion TEXT NULL,
            activo TINYINT(1) NOT NULL DEFAULT 1,
            path_imagen VARCHAR(255) NULL,
            created_at DATETIME NULL,
            updated_at DATETIME NULL,
            PRIMARY KEY (id),
            KEY productores_nombre (nombre)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    const origenes = await sequelize.query<{ id: number }>(
        `SELECT DISTINCT p.id
         FROM proveedores p
         WHERE p.observacion LIKE '%Productor%'
            OR p.id IN (SELECT c.id_productor FROM compras c WHERE c.id_productor IS NOT NULL)`,
        { type: QueryTypes.SELECT }
    );
    for (const row of origenes) {
        const existe = await sequelize.query<{ c: number }>(
            'SELECT COUNT(*) AS c FROM productores WHERE id = :id',
            { replacements: { id: row.id }, type: QueryTypes.SELECT }
        );
        if (Number(existe[0]?.c)) {
            continue;
        }
        await sequelize.query(
            `INSERT INTO productores (id, nombre, nit_ci, telefono, direccion, observacion, activo, path_imagen, created_at, updated_at)
             SELECT id, nombre, nit_ci, telefono, direccion, observacion, activo, path_imagen, created_at, updated_at
             FROM proveedores WHERE id = :id`,
            { replacements: { id: row.id } }
        );
    }

    await sequelize.query(`
        UPDATE compras c
        LEFT JOIN productores p ON p.id = c.id_productor
        SET c.id_productor = NULL
        WHERE c.id_productor IS NOT NULL AND p.id IS NULL
    `);

    const fks = await sequelize.query<{ CONSTRAINT_NAME: string; REFERENCED_TABLE_NAME: string }>(
        `SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME
         FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'compras'
           AND COLUMN_NAME = 'id_productor'
           AND REFERENCED_TABLE_NAME IS NOT NULL`,
        { type: QueryTypes.SELECT }
    );
    const yaApuntaProductores = fks.some((fk) => String(fk.REFERENCED_TABLE_NAME) === 'productores');
    if (!yaApuntaProductores) {
        for (const fk of fks) {
            await sequelize.query(`ALTER TABLE compras DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);
        }
        await sequelize.query(`
            ALTER TABLE compras
            ADD CONSTRAINT compras_id_productor_productores_fk
            FOREIGN KEY (id_productor) REFERENCES productores (id)
            ON UPDATE CASCADE ON DELETE RESTRICT
        `);
    }

    const maxId = await sequelize.query<{ m: number }>(
        'SELECT COALESCE(MAX(id), 0) AS m FROM productores',
        { type: QueryTypes.SELECT }
    );
    const siguiente = Number(maxId[0]?.m || 0) + 1;
    await sequelize.query(`ALTER TABLE productores AUTO_INCREMENT = ${siguiente}`);

    const columnasProd = await sequelize.query<ColumnRow>('SHOW COLUMNS FROM productores', {
        type: QueryTypes.SELECT
    });
    const nombresProd = new Set(columnasProd.map((col) => col.Field));
    if (!nombresProd.has('id_proveedor')) {
        await sequelize.query('ALTER TABLE productores ADD COLUMN id_proveedor INT NULL');
    }

    await sequelize.query(`
        UPDATE productores p
        INNER JOIN (
            SELECT id_productor, MIN(id_proveedor) AS id_proveedor
            FROM compras
            WHERE id_productor IS NOT NULL AND id_proveedor IS NOT NULL
            GROUP BY id_productor
        ) c ON c.id_productor = p.id
        SET p.id_proveedor = c.id_proveedor
        WHERE p.id_proveedor IS NULL
    `);

    const fksProv = await sequelize.query<{ CONSTRAINT_NAME: string; REFERENCED_TABLE_NAME: string }>(
        `SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME
         FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'productores'
           AND COLUMN_NAME = 'id_proveedor'
           AND REFERENCED_TABLE_NAME IS NOT NULL`,
        { type: QueryTypes.SELECT }
    );
    if (!fksProv.some((fk) => String(fk.REFERENCED_TABLE_NAME) === 'proveedores')) {
        for (const fk of fksProv) {
            await sequelize.query(`ALTER TABLE productores DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);
        }
        await sequelize.query(`
            ALTER TABLE productores
            ADD CONSTRAINT productores_id_proveedor_fk
            FOREIGN KEY (id_proveedor) REFERENCES proveedores (id)
            ON UPDATE CASCADE ON DELETE RESTRICT
        `);
    }
}

export async function asegurarEsquemaUsuarios(): Promise<void> {
    const columnas = await sequelize.query<ColumnRow>('SHOW COLUMNS FROM `user`', {
        type: QueryTypes.SELECT
    });
    const nombres = new Set(columnas.map((col) => col.Field));
    const faltantes: { nombre: string; ddl: string }[] = [
        { nombre: 'nombre', ddl: 'ADD COLUMN nombre VARCHAR(120) NULL' },
        { nombre: 'ci', ddl: 'ADD COLUMN ci VARCHAR(30) NULL' },
        { nombre: 'telefono', ddl: 'ADD COLUMN telefono VARCHAR(30) NULL' },
        { nombre: 'email', ddl: 'ADD COLUMN email VARCHAR(120) NULL' },
        { nombre: 'cargo', ddl: 'ADD COLUMN cargo VARCHAR(80) NULL' },
        { nombre: 'activo', ddl: 'ADD COLUMN activo TINYINT(1) NOT NULL DEFAULT 1' }
    ];
    for (const col of faltantes) {
        if (!nombres.has(col.nombre)) {
            await sequelize.query(`ALTER TABLE \`user\` ${col.ddl}`);
        }
    }
    await sequelize.query(`
        UPDATE \`user\`
        SET nombre = username
        WHERE nombre IS NULL OR TRIM(nombre) = ''
    `);
}
