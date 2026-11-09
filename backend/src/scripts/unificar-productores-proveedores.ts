import sequelize from '../db/connection';
import { unificarProductoresProveedores } from '../migrations/20261108-unificar-productores-proveedores';

async function main() {
    const esperado = process.argv.find(a => a.startsWith('--base='))?.slice(7);
    const base = sequelize.getDatabaseName();
    if (!esperado || esperado !== base || base !== 'db_empresa_rojas')
        throw new Error('Esta ejecución requiere --base=db_empresa_rojas y la misma base en .env.');
    await sequelize.authenticate();
    console.log(JSON.stringify({ base, ...await unificarProductoresProveedores() }));
}
main().catch(error => { console.error((error as Error).message); process.exitCode = 1; }).finally(() => sequelize.close());
