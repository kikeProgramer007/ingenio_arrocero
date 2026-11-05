import '../load-env';
import sequelize from '../db/connection';
import { assertBaseDeUsuario } from '../utils/db-sync';
import { up, VERSION_TRANSFORMACIONES } from '../migrations/20261105-produccion-transformaciones';
import { createHash } from 'crypto';
import { QueryTypes } from 'sequelize';
async function main() {
    if (!process.env.DB_NAME) throw new Error('Configure DB_NAME.');
    assertBaseDeUsuario(sequelize.getDatabaseName());
    await sequelize.authenticate();
    const tables = (await sequelize.getQueryInterface().showAllTables()).map(String).filter(t => !t.startsWith('produccion_'));
    const hash = async () => {
        const values = [];
        for (const table of tables) values.push([table, (await sequelize.query('SELECT * FROM `' + table.replace(/`/g,'``') + '`', { type: QueryTypes.SELECT })).map(v => JSON.stringify(v)).sort()]);
        return createHash('sha256').update(JSON.stringify(values)).digest('hex');
    };
    const before = await hash(); await up();
    if (before !== await hash()) throw new Error('Cambió información comercial durante la migración.');
    console.log(JSON.stringify({ base: sequelize.getDatabaseName(), migracion: VERSION_TRANSFORMACIONES, tablasComercialesVerificadas: tables.length, datosComerciales: 'sin cambios' }));
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => sequelize.close());
