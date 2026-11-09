// Read-only query regression: capture SQL and parameters without a database.
const assert = require('node:assert/strict');
const db = require('../dist/db/connection').default;
const { valoresFiltro, idsFiltro } = require('../dist/utils/filtros-multiples-produccion');
const { filtrosProduccion } = require('../dist/servicios/produccion-consulta.servicio');
const { consultaDescarguios } = require('../dist/servicios/descarguios-consulta.servicio');
const { filasEtapa } = require('../dist/servicios/produccion-etapas-consulta.servicio');
const { filasTransformacion } = require('../dist/servicios/produccion-transformaciones-consulta.servicio');
const { filasLotes } = require('../dist/servicios/produccion-trazabilidad.servicio');
const captured = [];
db.query = async (sql, options) => { captured.push({ sql, params: options.replacements }); return []; };

(async () => {
    assert.deepEqual(idsFiltro('1,2'), [1, 2]);
    assert.deepEqual(idsFiltro(''), []);
    assert.throws(() => idsFiltro('1 OR 1=1'));
    assert.throws(() => valoresFiltro('CONFIRMADO,INVALIDO', ['CONFIRMADO']));
    const f = filtrosProduccion({ id_productor: '1,2', modalidad: 'COMPRA,SERVICIO' });
    assert.deepEqual(f.productor, [1, 2]);
    assert.deepEqual(f.modalidad, ['COMPRA', 'SERVICIO']);
    const q = { id_productor: '1,2', modalidad: 'COMPRA,SERVICIO', estado: 'BORRADOR,CONFIRMADO', variedad: 'MAC-18,EPAGRI' };
    const c = consultaDescarguios(q);
    assert.match(c.sql, /o.id_productor IN \(:productor\)/);
    assert.deepEqual(c.params.estado, ['BORRADOR', 'CONFIRMADO']);
    assert.deepEqual(c.params.variedad, ['MAC-18', 'EPAGRI']);
    await filasEtapa('SECADO', { ...q, secadora: 'COMIL,ROJA' });
    assert.match(captured.at(-1).sql, /d.secadora IN \(:secadora\)/);
    assert.deepEqual(captured.at(-1).params.secadora, ['COMIL', 'ROJA']);
    await filasTransformacion('ENVASADO', { ...q, id_producto: '3,4', presentacion: '25 kg,46 kg' });
    assert.match(captured.at(-1).sql, /d.id_producto_destino IN \(:producto\)/);
    assert.deepEqual(captured.at(-1).params.producto, [3, 4]);
    await filasLotes({ id_productor: '1,2', estado: 'ACTIVO,AGOTADO', propiedad: 'PROPIO,TERCERO' });
    assert.deepEqual(captured.at(-1).params.estado, ['ACTIVO', 'AGOTADO']);
    // Single-value clients remain compatible.
    assert.deepEqual(consultaDescarguios({ id_productor: 1, estado: 'CONFIRMADO' }).params.productor, [1]);
    console.log('OK: multiple/single filters, bound SQL, empty selections and invalid values; no database writes.');
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => db.close());
