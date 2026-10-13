import { QueryTypes } from 'sequelize';
import { sequelize } from '../models';

async function main() {
    await sequelize.authenticate();
    const tablas = await sequelize.query<{ TABLE_NAME: string }>('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()', { type: QueryTypes.SELECT });
    const nombres = tablas.map(t => t.TABLE_NAME);
    console.log(JSON.stringify({ base: sequelize.getDatabaseName(), tablas: nombres.filter(t => ['ventas', 'venta_detalles', 'productos', 'ventas_entrega', 'reservas_producto', 'reservas_venta', 'despachos'].includes(t)) }));
    if (nombres.includes('ventas')) console.log(JSON.stringify(await sequelize.query('SELECT COUNT(*) ventas, COUNT(DISTINCT id_cliente) clientes FROM ventas', { type: QueryTypes.SELECT })));
    for (const tabla of ['ventas_entrega', 'reservas_producto', 'reservas_venta', 'despachos']) {
        if (nombres.includes(tabla)) console.log(JSON.stringify({ tabla, columnas: Object.keys(await sequelize.getQueryInterface().describeTable(tabla)) }));
    }
}
main().catch(e => { console.error((e as Error).message); process.exitCode = 1; }).finally(() => sequelize.close());
