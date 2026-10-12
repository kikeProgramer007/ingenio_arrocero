/**
 * Vacía movimientos y maestros de prueba para que el cliente empiece limpio.
 * Conserva usuario, perfil, menú, empresa, categorías y productos (stock en 0).
 *
 * Uso: npx tsc && node dist/scripts/limpiar-movimientos.js --yes
 */
import '../load-env';
import sequelize from '../db/connection';
import { QueryTypes } from 'sequelize';
import { assertBaseDeUsuario } from '../utils/db-sync';
import { seedInventarioBase } from '../seed/inventario.seed';
import { Productos } from '../models/productos.model';

const TABLAS_BORRAR = [
    'cobranzas',
    'venta_detalles',
    'ventas',
    'pagos_proveedor',
    'compra_detalles',
    'compras',
    'pagos_gasto',
    'gastos',
    'acopios',
    'campanas',
    'producciones',
    'movimientos_inventario',
    'movimientos_caja',
    'cajas',
    'clientes',
    'proveedores'
];

const TABLAS_CONSERVAR = ['user', 'perfil', 'programas', 'perfil_programas', 'empresa', 'categorias_producto', 'productos'];

async function contar(tabla: string): Promise<number> {
    const filas = await sequelize.query<{ n: number }>(`SELECT COUNT(*) AS n FROM \`${tabla}\``, {
        type: QueryTypes.SELECT
    });
    return Number(filas[0]?.n || 0);
}

async function existeTabla(tabla: string): Promise<boolean> {
    const filas = await sequelize.query<{ c: number }>(
        'SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :tabla',
        { replacements: { tabla }, type: QueryTypes.SELECT }
    );
    return Number(filas[0]?.c) > 0;
}

async function main(): Promise<void> {
    if (!process.argv.includes('--yes')) {
        console.error('Falta confirmar. Ejecutá con --yes');
        process.exit(1);
    }

    await sequelize.authenticate();
    const db = sequelize.getDatabaseName();
    assertBaseDeUsuario(db);
    console.log(`Base: ${db}`);

    const antes: Record<string, number> = {};
    for (const tabla of [...TABLAS_BORRAR, ...TABLAS_CONSERVAR]) {
        if (await existeTabla(tabla)) {
            antes[tabla] = await contar(tabla);
        }
    }
    console.log('Antes:', antes);

    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    try {
        for (const tabla of TABLAS_BORRAR) {
            if (!(await existeTabla(tabla))) {
                console.log(`Omitida (no existe): ${tabla}`);
                continue;
            }
            await sequelize.query(`DELETE FROM \`${tabla}\``);
            try {
                await sequelize.query(`ALTER TABLE \`${tabla}\` AUTO_INCREMENT = 1`);
            } catch (error) {
                console.warn(`No se pudo reiniciar AUTO_INCREMENT de ${tabla}:`, (error as Error).message);
            }
            console.log(`Vaciada ${tabla} (${antes[tabla] ?? 0} filas)`);
        }
    } finally {
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    }

    await Productos.update({ stock: 0 }, { where: {} });
    await seedInventarioBase();

    const despues: Record<string, number> = {};
    for (const tabla of [...TABLAS_BORRAR, ...TABLAS_CONSERVAR]) {
        if (await existeTabla(tabla)) {
            despues[tabla] = await contar(tabla);
        }
    }
    console.log('Después:', despues);
    console.log('Listo. Usuario, menú y empresa se conservaron. Stock de productos en 0.');
    await sequelize.close();
}

main().catch(async (error) => {
    console.error(error);
    try {
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
        await sequelize.close();
    } catch {
        /* ignore */
    }
    process.exit(1);
});
