import { QueryTypes } from 'sequelize';
import sequelize from '../db/connection';
import { COLUMNAS_DESCARGUIO, COLUMNAS_SOLICITUD_PRODUCCION, VERSION_DESCARGUIOS } from '../db/descarguio-schema';
import { VERSION_PRODUCCION } from '../constants/produccion.constants';

export async function up(): Promise<void> {
    const qi = sequelize.getQueryInterface();
    const base = await sequelize.query('SELECT version FROM produccion_migraciones WHERE version=:version', { type: QueryTypes.SELECT, replacements: { version: VERSION_PRODUCCION } });
    if (!base.length) throw new Error('Ejecute primero migrate:produccion (Fase 1).');
    for (const [tabla, definiciones] of [['produccion_descarguios', COLUMNAS_DESCARGUIO], ['produccion_operaciones', COLUMNAS_SOLICITUD_PRODUCCION]] as const) {
        const existentes = await qi.describeTable(tabla);
        for (const [columna, definicion] of Object.entries(definiciones)) if (!existentes[columna]) await qi.addColumn(tabla, columna, definicion);
    }
    const indices = await qi.showIndex('produccion_operaciones') as { name: string }[];
    if (!indices.some(i => i.name === 'produccion_clave_creacion_unica'))
        await qi.addIndex('produccion_operaciones', ['clave_creacion'], { name: 'produccion_clave_creacion_unica', unique: true });
    await sequelize.query('INSERT IGNORE INTO produccion_migraciones (version, aplicada_at) VALUES (:version, NOW())', {
        type: QueryTypes.INSERT, replacements: { version: VERSION_DESCARGUIOS }
    });
}
