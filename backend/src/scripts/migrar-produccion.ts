import '../load-env';
import { createHash } from 'crypto';
import { QueryTypes } from 'sequelize';
import sequelize from '../db/connection';
import { assertBaseDeUsuario } from '../utils/db-sync';
import { TABLAS_PRODUCCION } from '../db/produccion-schema';
import { up, VERSION_PRODUCCION } from '../migrations/20261105-produccion-base';

/** Huella de todos los registros anteriores, excepto los permisos que agrega esta migración. */
async function huella(tablas: string[]) {
    const resultado: Record<string, { registros: number; huella: string }> = {};
    for (const tabla of tablas) {
        const nombreSeguro = '`' + tabla.replace(/`/g, '``') + '`';
        const filas = await sequelize.query(`SELECT * FROM ${nombreSeguro}`, { type: QueryTypes.SELECT });
        const ordenadas = filas.map(f => JSON.stringify(f)).sort();
        resultado[tabla] = { registros: filas.length, huella: createHash('sha256').update(ordenadas.join('\n')).digest('hex') };
    }
    return resultado;
}

async function main() {
    const base = sequelize.getDatabaseName();
    assertBaseDeUsuario(base);
    if (!process.env.DB_NAME) throw new Error('Define DB_NAME explícitamente antes de migrar.');
    await sequelize.authenticate();
    const nuevas = new Set([...TABLAS_PRODUCCION.map(t => t.nombre), 'produccion_migraciones', 'programas', 'perfil_programas']);
    const anteriores = (await sequelize.getQueryInterface().showAllTables()).map(String).filter(t => !nuevas.has(t));
    const antes = await huella(anteriores);
    await up();
    const despues = await huella(anteriores);
    if (JSON.stringify(antes) !== JSON.stringify(despues)) throw new Error('Cambió algún registro anterior durante la migración. Revisar operaciones concurrentes.');
    console.log(JSON.stringify({ base, migracion: VERSION_PRODUCCION, tablasPreparadas: TABLAS_PRODUCCION.length, tablasAnterioresVerificadas: anteriores.length, datosAnteriores: 'sin cambios' }));
}
main().catch(error => { console.error((error as Error).message); process.exitCode = 1; }).finally(() => sequelize.close());
