const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { QueryTypes } = require('sequelize');
const db = require('../dist/db/connection').default;
const { unificarProductoresProveedores } = require('../dist/migrations/20261108-unificar-productores-proveedores');
const { opcionesDescarguio, listadoDescarguios } = require('../dist/servicios/descarguios-consulta.servicio');
const { consultarLotes, opcionesLotes } = require('../dist/servicios/produccion-trazabilidad.servicio');
const { filasEtapa } = require('../dist/servicios/produccion-etapas-consulta.servicio');
const { filasTransformacion } = require('../dist/servicios/produccion-transformaciones-consulta.servicio');
const leer = q => db.query(q, { type: QueryTypes.SELECT });
async function huella() {
    const tablas = ['compras', 'produccion_operaciones', 'produccion_lotes', 'produccion_operacion_lotes', 'movimientos_inventario', 'productos', 'movimientos_caja', 'pagos_proveedor'];
    const existentes = new Set((await db.getQueryInterface().showAllTables()).map(String));
    const datos = {};
    for (const tabla of tablas.filter(t => existentes.has(t))) {
        const filas = await leer('SELECT * FROM `' + tabla + '` ORDER BY id');
        datos[tabla] = filas.map(f => { delete f.id_productor; delete f.id_propietario; return f; });
    }
    return createHash('sha256').update(JSON.stringify(datos)).digest('hex');
}
(async () => {
    assert.equal(db.getDatabaseName(), 'db_empresa_rojas');
    await db.authenticate();
    const antes = await huella();
    const resultado = await unificarProductoresProveedores();
    assert.equal(await huella(), antes, 'No deben cambiar movimientos, importes, stock ni cantidades');
    assert(!(await db.getQueryInterface().showAllTables()).includes('productores'));
    assert.equal((await leer("SELECT * FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME='productores'")).length, 0);
    assert.equal(Number((await leer('SELECT COUNT(*) n FROM compras WHERE NOT(id_productor <=> id_proveedor)'))[0].n), 0);
    const cantidad = Number((await leer('SELECT COUNT(*) n FROM proveedores'))[0].n);
    await unificarProductoresProveedores();
    assert.equal(Number((await leer('SELECT COUNT(*) n FROM proveedores'))[0].n), cantidad, 'Repetir migración no duplica proveedores');
    assert.equal(await huella(), antes, 'Repetir migración no cambia movimientos');
    const opciones = await opcionesDescarguio({ grupo: 'productores', todos: '1' });
    const proveedores = await leer('SELECT id FROM proveedores WHERE activo=1 ORDER BY id');
    assert.deepEqual(opciones.map(p => p.id).sort((a,b) => a-b), proveedores.map(p => p.id).sort((a,b) => a-b));
    const compras = await opcionesDescarguio({ grupo: 'compras', todos: '1' });
    for (const c of compras) {
        const [compra] = await leer('SELECT id_proveedor FROM compras WHERE id=' + Number(c.id_compra));
        assert.equal(Number(c.id_productor), Number(compra.id_proveedor));
        assert(c.productor, 'La compra recupera el proveedor');
    }
    const filtros = { limit: 10 };
    await listadoDescarguios(filtros);
    await filasEtapa('SECADO', filtros);
    await filasEtapa('GUARDADO', filtros);
    await filasTransformacion('PROCESADO', filtros);
    await filasTransformacion('ENVASADO', filtros);
    await consultarLotes(filtros);
    await opcionesLotes();
    console.log(JSON.stringify({ ...resultado, proveedores: cantidad, comprasRecuperadas: compras.length, catalogosConsultas: 'OK', saldosStockCaja: 'sin cambios', repeticionMigracion: 'OK' }));
})().catch(e => { console.error(e.stack); process.exitCode = 1; }).finally(() => db.close());
