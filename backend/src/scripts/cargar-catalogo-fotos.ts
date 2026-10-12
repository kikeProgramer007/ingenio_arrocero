/**
 * Carga el catálogo extraído de las fotos (productos, clientes y proveedores).
 * No crea ventas, compras, saldos ni movimientos.
 *
 * Uso: npx tsc && node dist/scripts/cargar-catalogo-fotos.js
 */
import '../load-env';
import sequelize from '../db/connection';
import { assertBaseDeUsuario } from '../utils/db-sync';
import { seedInventarioBase } from '../seed/inventario.seed';
import { seedCatalogoFotos } from '../seed/catalogo-fotos.seed';

async function main(): Promise<void> {
    await sequelize.authenticate();
    assertBaseDeUsuario(sequelize.getDatabaseName());
    await seedInventarioBase();
    const creado = await seedCatalogoFotos();
    console.log('Catálogo cargado:', creado);
    await sequelize.close();
}

main().catch(async (error) => {
    console.error(error);
    try {
        await sequelize.close();
    } catch {
        /* ignore */
    }
    process.exit(1);
});
