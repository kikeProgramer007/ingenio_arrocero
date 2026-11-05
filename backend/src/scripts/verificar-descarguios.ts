import '../load-env';
import assert from 'assert/strict';
import { randomUUID, createHash } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PassThrough } from 'stream';
import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { QueryTypes, Transaction } from 'sequelize';
import { Compra, CompraDetalle, MovimientoInventario, Productor, Productos, Proveedor, ReservaProducto, User, sequelize } from '../models';
import { ErrorDescarguio, validarDescarguio } from '../dtos/descarguio.dto';
import { crearDescarguio, editarDescarguio, confirmarDescarguio, anularDescarguio, leerDesc } from '../servicios/descarguios.servicio';
import { listadoDescarguios, filasDescarguios, opcionesDescarguio } from '../servicios/descarguios-consulta.servicio';
import { permisoProduccion } from '../controllers/produccion-base.controller';
import { hojaDescarguios } from '../servicios/descarguios-reporte.servicio';
import { bufferReportePdf, enviarExcel } from '../utils/exportar';

async function huella() {
    const tablas = (await sequelize.getQueryInterface().showAllTables()).map(String).sort();
    const hash = createHash('sha256');
    for (const tabla of tablas) {
        const filas = await sequelize.query('SELECT * FROM `' + tabla.replace(/`/g, '``') + '`', { type: QueryTypes.SELECT });
        hash.update(tabla).update(filas.map(f => JSON.stringify(f)).sort().join('\n'));
    }
    return hash.digest('hex');
}
const rechaza = (trabajo: () => Promise<unknown>, status: number) => assert.rejects(trabajo, (e: unknown) => e instanceof ErrorDescarguio && e.status === status);
async function main() {
    if (process.env.NODE_ENV !== 'development') throw new Error('Esta comprobación solo admite NODE_ENV=development.');
    await sequelize.authenticate();
    if (process.argv.includes('--solo-consultas')) {
        const opciones: Record<string, number> = {};
        for (const grupo of ['productores','productos','ubicaciones','campanas','variedades','compras']) {
            const filas = await opcionesDescarguio({ grupo }); assert(filas.length <= 50); opciones[grupo] = filas.length;
        }
        const listado = await listadoDescarguios({ fecha_desde: '2026-01-01', fecha_hasta: '2026-12-31', modalidad: 'SERVICIO', estado: 'BORRADOR', buscar: '__CONSULTA_SIN_COINCIDENCIAS__', orden: 'boleta', direccion: 1 });
        assert.equal(listado.items.length, 0);
        const usuario = await User.findOne({ where: { activo: true, eliminado: false } }); assert(usuario);
        let permitidos = 0;
        for (const [ruta, query] of [['/descarguios', {}], ['/descarguios/exportar', { tipo: 'descarguios', orden: 'boleta', formato: 'pdf' }]] as const) {
            let status = 200;
            const res = { status: (s: number) => { status = s; return res; }, json: () => res };
            await permisoProduccion({ method: 'GET', path: ruta, query, user: { id: usuario.get('id') } } as unknown as Request,
                res as unknown as Response, () => { permitidos++; });
            assert.equal(status, 200);
        }
        assert.equal(permitidos, 2);
        console.log(JSON.stringify({ base: sequelize.getDatabaseName(), opciones, filtrosCombinados: 'OK', permisosConsultaYExportacion: 'OK', escrituras: 0 }));
        return;
    }
    const antes = await huella();
    const t = await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED });
    let archivoPdf = '', paginasPdf = 0;
    try {
        const usuario = await User.findOne({ where: { activo: true, eliminado: false }, transaction: t });
        assert(usuario, 'Se necesita un usuario activo.');
        const uid = Number(usuario.get('id'));
        const marca = randomUUID().slice(0,8);
        const productor = await Productor.create({ nombre: `PRODUCTOR DE PRUEBA ${marca} NOMBRE EXTENSO PARA COMPROBAR EL AJUSTE DEL TEXTO DENTRO DE LA MISMA CELDA EN LOS DOCUMENTOS OPERATIVOS`, activo: true }, { transaction: t });
        const pid = Number(productor.get('id'));
        const proveedor = await Proveedor.create({ nombre: `PROVEEDOR DE PRUEBA ${marca}`, activo: true }, { transaction: t });
        const producto = await Productos.create({ nombre: `ARROZ EN CHALA DE PRUEBA ${marca}`, unidad_medida: 'Fanega', stock: 100.123 }, { transaction: t });
        const productoId = Number(producto.get('id'));
        const compra = await Compra.create({ id_proveedor: proveedor.get('id'), id_productor: pid, fecha: new Date(), total: 0, saldo_pendiente: 0,
            estado: 'PENDIENTE', tipo_compra: 'CHALA', anticipada: true, estado_recepcion: 'PARCIAL', id_usuario: uid }, { transaction: t });
        const detalle = await CompraDetalle.create({ id_compra: compra.get('id'), id_producto: productoId, descripcion: 'Arroz de prueba',
            unidad: 'Fanega', cantidad: 200, cantidad_recibida: 100.123, precio_unitario: 0, subtotal: 0 }, { transaction: t });
        await MovimientoInventario.create({ id_producto: productoId, tipo: 'ENTRADA', cantidad: 100.123, stock_resultante: 100.123,
            origen: 'COMPRA', origen_id: compra.get('id'), fecha: new Date(), id_usuario: uid }, { transaction: t });
        const [recepcionId] = await sequelize.query(`INSERT INTO recepciones_compra (id_compra,id_detalle,cantidad,fecha,id_usuario,created_at,updated_at)
            VALUES (:compra,:detalle,100.123,NOW(),:uid,NOW(),NOW())`, { replacements: { compra: compra.get('id'), detalle: detalle.get('id'), uid }, transaction: t, type: QueryTypes.INSERT });
        const financiero = async () => {
            const resultados = [];
            for (const tabla of ['compras','pagos_proveedor','movimientos_caja','ventas']) {
                const [fila] = await leerDesc(`SELECT COUNT(*) cantidad FROM ${tabla}`, {}, t); resultados.push(Number(fila.cantidad));
            }
            return resultados;
        };
        const finAntes = await financiero();
        const fecha = new Date().toISOString();
        const base = { fecha, modalidad: 'SERVICIO', id_productor: pid, id_producto: productoId, boleta: `BOLETA-${marca}`,
            variedad: 'MAC-18 DE PRUEBA', cantidad: 250.125, unidad: 'Fanega', humedad_entrada: 0, impurezas_entrada: null,
            peso_real_kg: null, punto_descarga: `SILO DE PRUEBA ${marca}`, localidad: 'LOCALIDAD ESCRITA MANUALMENTE' };
        const dto = validarDescarguio(base, true);
        assert.equal(dto.humedad_entrada, 0); assert.equal(dto.peso_real_kg, null);
        for (const invalido of [{ cantidad: -1 }, { humedad_entrada: 101 }, { cantidad: '1.0001' }, { id_productor: true }, { unidad: 'No autorizada' }, { fecha: '2026-02-31T10:00:00Z' }]) assert.throws(() => validarDescarguio({ ...base, ...invalido }, true));
        console.log('Validaciones de campos y datos no medidos: OK');

        const clave = randomUUID();
        let servicio = await crearDescarguio({ fecha, modalidad: 'SERVICIO', clave_creacion: clave }, uid, t);
        assert.equal(servicio.id_lote, null);
        assert.equal((await crearDescarguio({ fecha, modalidad: 'SERVICIO', clave_creacion: clave }, uid, t)).id, servicio.id);
        await rechaza(() => crearDescarguio({ ...base, clave_creacion: clave }, uid, t), 409);
        servicio = await editarDescarguio(servicio.id, { ...base, version: servicio.version }, uid, t);
        await rechaza(() => editarDescarguio(servicio.id, { ...base, version: 0 }, uid, t), 409);
        const ck = randomUUID();
        servicio = await confirmarDescarguio(servicio.id, { version: servicio.version, clave_confirmacion: ck }, uid, t);
        assert.equal((await confirmarDescarguio(servicio.id, { version: 0, clave_confirmacion: ck }, uid, t)).id_lote, servicio.id_lote);
        await rechaza(() => confirmarDescarguio(servicio.id, { version: servicio.version, clave_confirmacion: randomUUID() }, uid, t), 409);
        await rechaza(() => editarDescarguio(servicio.id, { ...base, version: servicio.version }, uid, t), 409);
        const [lote] = await leerDesc('SELECT * FROM produccion_lotes WHERE id=:id', { id: servicio.id_lote }, t);
        assert.equal(Number(lote.id_propietario), pid); assert.equal(Number(lote.cantidad_disponible), 250.125);
        const [cuenta] = await leerDesc('SELECT COUNT(*) cantidad FROM produccion_movimientos WHERE id_operacion=:id', { id: servicio.id }, t);
        assert.equal(Number(cuenta.cantidad), 1);
        assert.equal(Number((await Productos.findByPk(productoId, { transaction: t }))!.get('stock')), 100.123);
        console.log('Servicio, borradores, versiones y doble confirmación: OK');

        // Referencia de una etapa futura: la anulación debe bloquearse incluso si es borrador.
        const [futuraId] = await sequelize.query(`INSERT INTO produccion_operaciones (codigo,tipo,fecha,estado,modalidad,id_propietario,id_productor,id_usuario,created_at,updated_at)
            VALUES (:codigo,'SECADO',NOW(),'BORRADOR','SERVICIO',:pid,:pid,:uid,NOW(),NOW())`, { replacements: { codigo: `TEST-SEC-${marca}`, pid, uid }, type: QueryTypes.INSERT, transaction: t });
        await sequelize.query("INSERT INTO produccion_operacion_lotes (id_operacion,id_lote,rol,cantidad,unidad) VALUES (:op,:lote,'ENTRADA',1,'Fanega')", {
            replacements: { op: futuraId, lote: servicio.id_lote }, transaction: t
        });
        await rechaza(() => anularDescarguio(servicio.id, { version: servicio.version, motivo: 'ANULACION DE PRUEBA' }, uid, t), 409);
        let anulable = await crearDescarguio({ ...base, clave_creacion: randomUUID() }, uid, t);
        anulable = await confirmarDescarguio(anulable.id, { version: anulable.version, clave_confirmacion: randomUUID() }, uid, t);
        const vAnular = anulable.version;
        anulable = await anularDescarguio(anulable.id, { version: vAnular, motivo: 'ERROR DE REGISTRO DE PRUEBA' }, uid, t);
        await anularDescarguio(anulable.id, { version: vAnular, motivo: 'ERROR DE REGISTRO DE PRUEBA' }, uid, t);
        assert.equal(anulable.estado, 'ANULADO');
        const [rev] = await leerDesc("SELECT COUNT(*) cantidad FROM produccion_movimientos WHERE id_operacion=:id AND tipo='REVERSO'", { id: anulable.id }, t);
        assert.equal(Number(rev.cantidad), 1);
        console.log('Anulación con reversión y bloqueo de procesos relacionados: OK');

        const propio = { ...base, modalidad: 'COMPRA', id_compra_detalle: Number(detalle.get('id')), id_recepcion_compra: Number(recepcionId), cantidad: 30.111 };
        let primero = await crearDescarguio({ ...propio, clave_creacion: randomUUID() }, uid, t);
        primero = await confirmarDescarguio(primero.id, { version: primero.version, clave_confirmacion: randomUUID() }, uid, t);
        const [propietario] = await leerDesc('SELECT id_propietario FROM produccion_lotes WHERE id=:id', { id: primero.id_lote }, t);
        assert.equal(propietario.id_propietario, null);
        let exceso = await crearDescarguio({ ...propio, cantidad: 80, clave_creacion: randomUUID() }, uid, t);
        await rechaza(() => confirmarDescarguio(exceso.id, { version: exceso.version, clave_confirmacion: randomUUID() }, uid, t), 409);
        let segundo = await crearDescarguio({ ...propio, cantidad: 70.012, clave_creacion: randomUUID() }, uid, t);
        await ReservaProducto.create({ id_producto: productoId, cantidad: 1 }, { transaction: t });
        await rechaza(() => confirmarDescarguio(segundo.id, { version: segundo.version, clave_confirmacion: randomUUID() }, uid, t), 409);
        await ReservaProducto.update({ cantidad: 0 }, { where: { id_producto: productoId }, transaction: t });
        segundo = await confirmarDescarguio(segundo.id, { version: segundo.version, clave_confirmacion: randomUUID() }, uid, t);
        const incorrecto = await crearDescarguio({ ...propio, cantidad: 1, unidad: 'Kilo', clave_creacion: randomUUID() }, uid, t);
        await rechaza(() => confirmarDescarguio(incorrecto.id, { version: incorrecto.version, clave_confirmacion: randomUUID() }, uid, t), 409);
        await anularDescarguio(primero.id, { version: primero.version, motivo: 'LIBERAR VINCULO DE PRUEBA' }, uid, t);
        const reposicion = await crearDescarguio({ ...propio, clave_creacion: randomUUID() }, uid, t);
        await confirmarDescarguio(reposicion.id, { version: reposicion.version, clave_confirmacion: randomUUID() }, uid, t);
        assert.equal(Number((await Productos.findByPk(productoId, { transaction: t }))!.get('stock')), 100.123);
        assert.equal(await MovimientoInventario.count({ where: { id_producto: productoId }, transaction: t }), 1);
        assert.deepEqual(await financiero(), finAntes);
        console.log('Compra parcial, reservas, unidades y ausencia de doble ingreso/efectos financieros: OK');

        for (let i=0;i<12;i++) await crearDescarguio({ ...base, boleta: `EXPORT-${marca}-${i}`, variedad: `EXPORT-${marca}`, cantidad: 1.125, clave_creacion: randomUUID() }, uid, t);
        const filtro = { id_productor: pid, variedad: `EXPORT-${marca}`, limit: 10 };
        const listado = await listadoDescarguios(filtro, t);
        assert.equal(listado.total, 12); assert.equal(listado.items.length, 10);
        assert.equal((await filasDescarguios(filtro, true, t)).length, 12);
        const hoja = await hojaDescarguios(filtro, 'pdf', t);
        const pdf = await bufferReportePdf([hoja]);
        const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-descarguios-'));
        archivoPdf = path.join(carpeta, 'control-descarguios-prueba.pdf'); paginasPdf = pdf.paginas;
        fs.writeFileSync(archivoPdf, pdf.buffer);
        const hojaExcel = await hojaDescarguios(filtro, 'xlsx', t);
        const stream = new PassThrough(); const chunks: Buffer[] = [];
        stream.on('data', chunk => chunks.push(Buffer.from(chunk)));
        const fin = new Promise<void>(resolve => stream.on('finish', resolve));
        const response = Object.assign(stream, { setHeader: () => response }) as unknown as Response;
        await enviarExcel(response, 'prueba', [hojaExcel]); await fin;
        const excel = new ExcelJS.Workbook(); await excel.xlsx.load(Buffer.concat(chunks));
        let cantidadesExactas = 0;
        excel.worksheets[0].getColumn(hojaExcel.columnas.indexOf('Cantidad') + 1).eachCell(cell => { if (cell.value === 1.125) { assert.equal(cell.numFmt, '#,##0.###'); cantidadesExactas++; } });
        assert.equal(cantidadesExactas, 12);
        console.log('Filtros globales, paginación, PDF completo y precisión de Excel: OK');
    } finally { await t.rollback(); }
    assert.equal(await huella(), antes, 'Cambió algún dato persistente; revisar actividad concurrente.');
    console.log(JSON.stringify({ base: sequelize.getDatabaseName(), pruebas: 'OK', registrosDePruebaPersistidos: 0, datosAnteriores: 'sin cambios', archivoPdf, paginasPdf }));
}
main().catch(e => { console.error((e as Error).stack || (e as Error).message); process.exitCode=1; }).finally(() => sequelize.close());
