import '../load-env';
import { createHash } from 'crypto';
import { QueryTypes } from 'sequelize';
import sequelize from '../db/connection';
import { assertBaseDeUsuario } from '../utils/db-sync';
import { up } from '../migrations/20261105-produccion-descarguios';
import { VERSION_DESCARGUIOS } from '../db/descarguio-schema';

async function huella(tablas: string[]) {
    const salida: Record<string, string> = {};
    for (const tabla of tablas) {
        const filas = await sequelize.query('SELECT * FROM `' + tabla.replace(/`/g, '``') + '`', { type: QueryTypes.SELECT });
        salida[tabla] = createHash('sha256').update(filas.map(f => JSON.stringify(f)).sort().join('\n')).digest('hex');
    }
    return JSON.stringify(salida);
}
async function main() {
    if (!process.env.DB_NAME) throw new Error('Configure DB_NAME explícitamente.');
    assertBaseDeUsuario(sequelize.getDatabaseName());
    await sequelize.authenticate();
    const tablas = (await sequelize.getQueryInterface().showAllTables()).map(String).filter(t => !t.startsWith('produccion_'));
    const antes = await huella(tablas);
    await up();
    if (antes !== await huella(tablas)) throw new Error('Cambió algún registro comercial durante la migración; revisar actividad concurrente.');
    console.log(JSON.stringify({ base: sequelize.getDatabaseName(), migracion: VERSION_DESCARGUIOS, tablasComercialesVerificadas: tablas.length, datosComerciales: 'sin cambios' }));
}
main().catch(e => { console.error((e as Error).message); process.exitCode = 1; }).finally(() => sequelize.close());
