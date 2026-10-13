import { createHash } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../models';
import { assertBaseDeUsuario } from '../utils/db-sync';
import { up } from '../migrations/20261013-despachos';

async function huellaAnterior(): Promise<string> {
    const ventas = await sequelize.query('SELECT id, total, saldo_pendiente, estado FROM ventas ORDER BY id', { type: QueryTypes.SELECT });
    const productos = await sequelize.query('SELECT id, stock FROM productos ORDER BY id', { type: QueryTypes.SELECT });
    return createHash('sha256').update(JSON.stringify({ ventas, productos })).digest('hex');
}
async function main() {
    assertBaseDeUsuario(sequelize.getDatabaseName());
    await sequelize.authenticate();
    const anterior = await huellaAnterior();
    await up();
    if (anterior !== await huellaAnterior()) throw new Error('Las ventas o el stock cambiaron durante la migracion; revisar operaciones concurrentes.');
    console.log(JSON.stringify({ migracion: '20261013-despachos', base: sequelize.getDatabaseName(), tablas: ['ventas_entrega', 'reservas_producto', 'reservas_venta', 'despachos'], programa: '/despachos', ventasYStockAnteriores: 'sin cambios' }));
}
main().catch(e => { console.error((e as Error).message); process.exitCode = 1; }).finally(() => sequelize.close());
