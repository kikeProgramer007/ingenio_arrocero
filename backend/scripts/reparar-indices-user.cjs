/**
 * Desde backend:
 *   node scripts/reparar-indices-user.cjs             (solo revisar)
 *   node scripts/reparar-indices-user.cjs --aplicar   (eliminar redundantes)
 * Reutiliza la conexion compilada y el .env del proyecto. No importa modelos,
 * no ejecuta sync y no crea, modifica ni elimina registros de usuarios.
 * Detener el backend antes de aplicar para evitar cambios de esquema simultaneos.
 */
const fs = require('node:fs');
const path = require('node:path');
const sequelize = require('../dist/db/connection').default;
const quote = value => '`' + String(value).replace(/`/g, '``') + '`';

function candidatos(rows) {
    const grupos = new Map();
    for (const row of rows) {
        const nombre = row.Key_name;
        if (!grupos.has(nombre)) grupos.set(nombre, []);
        grupos.get(nombre).push(row);
    }
    // Solo UNIQUE completos sobre username. No tocar PRIMARY, prefijos,
    // indices compuestos, funcionales, no visibles ni de otras columnas.
    return [...grupos.entries()].filter(([nombre, columnas]) =>
        nombre !== 'PRIMARY' && columnas.length === 1 &&
        Number(columnas[0].Non_unique) === 0 &&
        columnas[0].Column_name === 'username' &&
        columnas[0].Sub_part == null &&
        !columnas[0].Expression &&
        String(columnas[0].Index_type).toUpperCase() === 'BTREE' &&
        String(columnas[0].Visible || 'YES').toUpperCase() === 'YES'
    ).map(([nombre]) => nombre).sort((a, b) =>
        (a === 'username' ? -1 : b === 'username' ? 1 : a.localeCompare(b, 'en', { numeric: true }))
    );
}

async function main() {
    if (process.argv.slice(2).some(arg => arg !== '--aplicar')) {
        throw new Error('Argumento no reconocido. Use --aplicar o ningun argumento.');
    }
    if (sequelize.getDatabaseName() !== 'db_empresa_rojas') {
        throw new Error('Este script esta limitado a la base de desarrollo db_empresa_rojas.');
    }
    await sequelize.authenticate();
    const [indices] = await sequelize.query('SHOW INDEX FROM `user`');
    const nombres = candidatos(indices);
    console.log('Base:', sequelize.getDatabaseName());
    console.log('Indices UNIQUE completos de username:', nombres.length);
    if (!nombres.length) throw new Error('No se encontro un indice compatible; no se realizo ningun cambio.');
    console.log('Se conserva:', nombres[0]);
    const redundantes = nombres.slice(1);
    if (!redundantes.length) {
        console.log('No hay indices redundantes de username. No se necesita ninguna modificacion.');
        return;
    }
    const sql = redundantes.map(nombre => `ALTER TABLE \`user\` DROP INDEX ${quote(nombre)};`);
    console.log(sql.join('\n'));
    if (!process.argv.includes('--aplicar')) {
        console.log('Solo revision. Para ejecutar: node scripts/reparar-indices-user.cjs --aplicar');
        return;
    }
    const [estructura] = await sequelize.query('SHOW CREATE TABLE `user`');
    const carpeta = path.resolve(__dirname, '../tmp');
    fs.mkdirSync(carpeta, { recursive: true });
    const respaldo = path.join(carpeta, `indices-user-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(respaldo, JSON.stringify({ base: sequelize.getDatabaseName(), estructura, indices, conservar: nombres[0], sql }, null, 2));
    console.log('Respaldo de estructura e indices (no de datos):', respaldo);
    // DDL no es transaccional. Cada paso comprueba que el indice conservado sigue
    // existiendo; si falla, se puede volver a ejecutar para terminar la limpieza.
    for (const sentencia of sql) {
        const [actuales] = await sequelize.query('SHOW INDEX FROM `user`');
        if (!candidatos(actuales).includes(nombres[0])) throw new Error('El indice a conservar cambio. Se detiene la limpieza.');
        await sequelize.query(sentencia);
    }
    const [finales] = await sequelize.query('SHOW INDEX FROM `user`');
    const restantes = candidatos(finales);
    if (restantes.length !== 1 || restantes[0] !== nombres[0]) throw new Error('Revisar indices: resultado inesperado.');
    console.log(`Limpieza completada: ${redundantes.length} indices redundantes eliminados; UNIQUE de username conservado.`);
    console.log('Usuarios y contrasenas existentes conservados.');
}

main().catch(error => {
    console.error('No se pudo completar:', error.message);
    process.exitCode = 1;
}).finally(() => sequelize.close());
