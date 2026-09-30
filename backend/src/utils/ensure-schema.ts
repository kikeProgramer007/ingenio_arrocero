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

    const idCaja = porNombre.get('id_caja');
    if (idCaja && String(idCaja.Null).toUpperCase() === 'NO') {
        await sequelize.query('ALTER TABLE gastos MODIFY COLUMN id_caja INT NULL');
    }
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
        { nombre: 'path_logo', ddl: 'ADD COLUMN path_logo VARCHAR(255) NULL' }
    ];
    for (const col of faltantes) {
        if (!nombres.has(col.nombre)) {
            await sequelize.query(`ALTER TABLE empresa ${col.ddl}`);
        }
    }
}
