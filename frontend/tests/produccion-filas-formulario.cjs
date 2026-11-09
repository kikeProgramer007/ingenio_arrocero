// Regression checks for row identity and validation; no browser or database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const base = path.resolve(__dirname, '../src/app/pages/produccion');
function load(file, dependencies = {}) {
    const source = fs.readFileSync(path.join(base, file), 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true } }).outputText;
    const exports = {};
    const stub = new Proxy({}, { get: (_, name) => name === 'Component' ? () => c => c : name === 'inject' ? () => ({ snapshot: { data: { etapa: 'secados' } } }) : name === 'permisoEtapa' ? () => true : class {} });
    vm.runInNewContext(js, { exports, require: name => dependencies[name] || stub, crypto: require('node:crypto').webcrypto, Date, console });
    return exports;
}
const stages = load('produccion-etapa-form.ts');
const transforms = load('produccion-transformacion-form.ts', { './produccion-etapa-form': stages });
const make = (Class = stages.ProduccionEtapaFormPage) => new Class({}, {}, {}, {});
const lot = id => ({ id_lote: id, cantidad: 2, seleccion: { id, cantidad_disponible: 10, unidad: 'Fanega' }, sugerencias: [] });
const f = make();
assert.equal(f.camposTexto, f.camposTexto, 'Field definitions must not be recreated during change detection');
assert.equal(f.mediciones, f.mediciones);
f.origenes = [lot(1), lot(2), lot(3)];
const survivor = f.origenes[2], key = f.claveFila(survivor);
let canceled = false;
f.origenes[1].request = { unsubscribe() { canceled = true; } };
f.quitar(1);
assert.ok(canceled);
assert.equal(f.origenes[1], survivor);
assert.equal(f.claveFila(survivor), key);
assert.equal(survivor.cantidad, 2);
for (let i = 0; i < 50; i++) { f.agregar(); f.quitar(f.origenes.length - 1); }
assert.equal(f.origenes.length, 2);
assert.equal(f.claveFila(survivor), key);
while (f.origenes.length < 20) f.agregar();
f.agregar(); assert.equal(f.origenes.length, 20);
while (f.origenes.length > 1) f.quitar(0);
f.quitar(0); assert.equal(f.origenes.length, 1);
assert.equal(f.origenes[0].seleccion, null);
assert.equal(f.validarFormulario(false), false);
f.origenes = [lot(1)]; assert.equal(f.validarFormulario(false), true);
f.origenes.push(lot(1)); assert.equal(f.validarFormulario(false), false);
assert.ok(f.campos['origenes.1.id_lote']);
f.origenes = [lot(1)];
for (const value of [0, -1, Infinity, NaN, 1.1234, 11]) { f.origenes[0].cantidad = value; assert.equal(f.validarFormulario(false), false); }
f.origenes[0].cantidad = 2;
f.origenes[0].seleccion = 'texto libre'; assert.equal(f.validarFormulario(false), false);
f.origenes = [lot(1)]; f.form.humedad_salida = 101; assert.equal(f.validarFormulario(false), false);
f.form.humedad_salida = 11; f.form.secadora = 'COMIL'; f.form.inicio = new Date('2026-11-06T10:00:00Z'); f.form.fin = new Date('2026-11-06T09:00:00Z');
assert.equal(f.validarFormulario(true), false);
f.form.fin = new Date('2026-11-06T12:00:00Z'); assert.equal(f.validarFormulario(true), true);
const p = make(transforms.ProduccionTransformacionFormPage); p.ruta = 'procesados'; p.origenes = [lot(1)];
assert.equal(p.validarFormulario(true), false);
p.agregarResultado(); const result = p.resultados[0], resultKey = p.claveFila(result);
p.agregarResultado(); p.quitarResultado(1); assert.equal(p.claveFila(p.resultados[0]), resultKey);
Object.assign(result, { seleccion: { id: 5 }, cantidad: 3, clasificacion: 'Entero', unidad: 'Quintal' });
assert.equal(p.validarFormulario(true), true);
console.log('OK: stable fields/rows, 50 add/remove cycles, limits, empty/duplicate lots, quantities, stock, humidity, dates and processed results.');

