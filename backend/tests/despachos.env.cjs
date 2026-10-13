// Pruebas contra .env: rollback para escenarios simples y limpieza estricta de fixtures UUID para concurrencia.
require('reflect-metadata');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Op } = require('sequelize');
const m = require('../dist/models');
const s = require('../dist/servicios/despachos.servicio');
const { aplicarStock, TIPO_INVENTARIO } = require('../dist/utils/inventario');
let checks = 0;
const prefijo = 'TEST_DESPACHOS_' + crypto.randomUUID();
let fixtureProducto;
function check(valor, descripcion) { assert.ok(valor, descripcion); checks++; console.log('OK: ' + descripcion); }
async function main() {
    await m.sequelize.authenticate();
    assert.equal(s.despachosHabilitados(), true, 'Despachos debe estar habilitado en .env');
    const usuario = await m.User.findOne({ where: { activo: true, eliminado: false }, attributes: ['id'] });
    const cliente = await m.Cliente.findOne({ where: { activo: true }, attributes: ['id'] });
    assert.ok(usuario && cliente, 'Se requiere usuario y cliente activos');
    const idUsuario = Number(usuario.get('id')); const idCliente = Number(cliente.get('id'));
    async function crearVenta(productos, transaction, clave = prefijo + '_' + crypto.randomUUID()) {
        const v = await m.Venta.create({ id_cliente: idCliente, id_usuario: idUsuario, fecha: new Date(), total: 10, saldo_pendiente: 10, estado: 'PENDIENTE', observacion: prefijo }, { transaction });
        await m.VentaEntrega.create({ id_venta: v.get('id'), clave: clave.slice(-80), solicitud: 'test', estado: 'PENDIENTE' }, { transaction });
        const lineas = [];
        for (const item of productos.sort((a,b)=>a.id-b.id)) {
            await m.Productos.findByPk(item.id, { transaction, lock: transaction.LOCK.UPDATE });
            const d = await m.VentaDetalle.create({ id_venta:v.get('id'),id_producto:item.id,descripcion:prefijo,cantidad:item.cantidad,precio_unitario:10,subtotal:item.cantidad*10 },{transaction});
            await s.reservarLinea(d,transaction); lineas.push(d);
        }
        return { v, lineas };
    }
    const t = await m.sequelize.transaction();
    let p;
    try {
        p = await m.Productos.create({nombre:prefijo,stock:500,unidad_medida:'Quintal',precio_venta:10},{transaction:t});
        const otro = await m.Productos.create({nombre:prefijo+'_kilo',stock:20,unidad_medida:'Kilo',precio_venta:5},{transaction:t});
        const id = Number(p.get('id'));
        const estado = async () => {
            const prod = await m.Productos.findByPk(id,{transaction:t});
            const r = await m.ReservaProducto.findByPk(id,{transaction:t});
            return { fisico:Number(prod.get('stock')),reservado:Number(r?.get('cantidad')||0) };
        };
        const venta = await crearVenta([{id,cantidad:100}],t);
        await venta.v.update({estado:'PAGADA',saldo_pendiente:0},{transaction:t});
        let e = await estado(); check(e.fisico===500&&e.reservado===100,'Venta pagada sin entrega: fisico 500, reservado 100, disponible 400');
        const datos = {clave:crypto.randomUUID(),persona_retira:'Persona de prueba',lineas:[{id_detalle:Number(venta.lineas[0].get('id')),cantidad:40}]};
        const despacho = await s.registrarDespacho(Number(venta.v.get('id')),datos,idUsuario,t);
        e=await estado();check(e.fisico===460&&e.reservado===60,'Despacho parcial: fisico 460, reservado 60, disponible 400');
        const repetido=await s.registrarDespacho(Number(venta.v.get('id')),datos,idUsuario,t);
        check(despacho.get('id')===repetido.get('id'),'Reintento devuelve el mismo despacho sin otra salida');
        await assert.rejects(()=>s.registrarDespacho(Number(venta.v.get('id')),{...datos,persona_retira:'Otra persona'},idUsuario,t),s.ErrorDespacho);check(true,'Clave de despacho con contenido distinto rechazada');
        await assert.rejects(()=>s.registrarDespacho(Number(venta.v.get('id')),{...datos,clave:crypto.randomUUID(),lineas:[{id_detalle:Number(venta.lineas[0].get('id')),cantidad:61}]},idUsuario,t),s.ErrorDespacho);check(true,'No permite entregar mas de lo pendiente');
        await s.registrarDespacho(Number(venta.v.get('id')),{...datos,clave:crypto.randomUUID(),lineas:[{id_detalle:Number(venta.lineas[0].get('id')),cantidad:60}]},idUsuario,t);
        e=await estado();check(e.fisico===400&&e.reservado===0,'Varios retiros: fisico 400, reservado 0, disponible 400');
        check((await m.VentaEntrega.findByPk(venta.v.get('id'),{transaction:t})).get('estado')==='COMPLETO','Estado completo independiente del pago');
        await assert.rejects(()=>s.liberarReservas(Number(venta.v.get('id')),t),s.ErrorDespacho);check(true,'Anulacion entregada bloqueada sin devolucion fisica');
        const credito=await crearVenta([{id,cantidad:5}],t);
        await s.registrarDespacho(Number(credito.v.get('id')),{clave:crypto.randomUUID(),persona_retira:'Retiro a credito',lineas:[{id_detalle:Number(credito.lineas[0].get('id')),cantidad:5}]},idUsuario,t);
        check(credito.v.get('estado')==='PENDIENTE'&&(await m.VentaEntrega.findByPk(credito.v.get('id'),{transaction:t})).get('estado')==='COMPLETO','Credito con entrega completa no cambia deuda ni necesita caja');
        const anulable=await crearVenta([{id,cantidad:10}],t);
        const fisico=(await estado()).fisico;
        await s.liberarReservas(Number(anulable.v.get('id')),t);
        e=await estado();check(e.fisico===fisico&&e.reservado===0,'Anulacion sin entrega libera reservas y no repone fisico');
        const mixta=await crearVenta([{id,cantidad:2},{id:Number(otro.get('id')),cantidad:3.5}],t);
        await m.VentaDetalle.create({id_venta:mixta.v.get('id'),descripcion:'Flete de prueba',cantidad:1,precio_unitario:5,subtotal:5},{transaction:t});
        await s.registrarDespacho(Number(mixta.v.get('id')),{clave:crypto.randomUUID(),persona_retira:'Retiro varias unidades',lineas:mixta.lineas.map(l=>({id_detalle:Number(l.get('id')),cantidad:1}))},idUsuario,t);
        const reservas=await m.ReservaVenta.findAll({where:{id_venta:mixta.v.get('id')},transaction:t});
        check(reservas.length===2&&new Set(reservas.map(r=>r.get('unidad'))).size===2,'Varios productos y unidades; servicio sin reserva');
        const salida=await aplicarStock({transaction:t,idProducto:id,delta:-500,tipo:TIPO_INVENTARIO.SALIDA,origen:'PRUEBA',origenId:null,idUsuario});
        check(!salida.ok,'Otras salidas no consumen reservas');
        const kardex=await m.MovimientoInventario.findAll({where:{id_producto:id,origen:'DESPACHO'},transaction:t});
        check(kardex.length===4&&kardex.every(k=>k.get('origen_id')&&String(k.get('observacion')).includes('venta #')),'Kardex referencia venta y despacho');
    } finally { await t.rollback(); }
    check(!(await m.Productos.findByPk(p.get('id'))),'Rollback elimina todos los datos de escenarios simples');
    fixtureProducto=await m.Productos.create({nombre:prefijo+'_concurrencia',stock:5,unidad_medida:'Quintal',precio_venta:10});
    const idFixture=Number(fixtureProducto.get('id'));
    const carreras=await Promise.allSettled([1,2].map(()=>m.sequelize.transaction(t=>crearVenta([{id:idFixture,cantidad:5}],t))));
    check(carreras.filter(r=>r.status==='fulfilled').length===1&&carreras.filter(r=>r.status==='rejected').length===1,'Ventas concurrentes reservan una sola disponibilidad');
    const ganadora=carreras.find(r=>r.status==='fulfilled').value;
    const solicitud={clave:crypto.randomUUID(),persona_retira:'Doble clic de prueba',lineas:[{id_detalle:Number(ganadora.lineas[0].get('id')),cantidad:2}]};
    const doble=await Promise.all([1,2].map(()=>m.sequelize.transaction(t=>s.registrarDespacho(Number(ganadora.v.get('id')),solicitud,idUsuario,t))));
    check(doble[0].get('id')===doble[1].get('id'),'Doble clic concurrente registra un solo despacho');
    const entregas=await Promise.allSettled([1,2].map(()=>m.sequelize.transaction(t=>s.registrarDespacho(Number(ganadora.v.get('id')),{...solicitud,clave:crypto.randomUUID()},idUsuario,t))));
    check(entregas.filter(r=>r.status==='fulfilled').length===1&&entregas.filter(r=>r.status==='rejected').length===1,'Despachos concurrentes no superan el pendiente');
    check(Number((await m.Productos.findByPk(idFixture)).get('stock'))===1&&Number((await m.ReservaProducto.findByPk(idFixture)).get('cantidad'))===1,'Fisico y reservado consistentes tras concurrencia');
    console.log(checks+' comprobaciones en BD actual '+m.sequelize.getDatabaseName()+'.');
}
async function limpiar() {
    // Solo IDs enlazados a este UUID; nunca selecciona registros por cliente o usuario.
    const ventas=await m.Venta.findAll({where:{observacion:prefijo},attributes:['id']});
    const ids=ventas.map(v=>v.get('id'));
    await m.sequelize.transaction(async transaction=>{
        if(ids.length){
            const where={id_venta:{[Op.in]:ids}};
            await m.Despacho.destroy({where,transaction});
            await m.ReservaVenta.destroy({where,transaction});
            await m.VentaEntrega.destroy({where,transaction});
            await m.VentaDetalle.destroy({where,transaction});
            await m.Venta.destroy({where:{id:{[Op.in]:ids},observacion:prefijo},transaction});
        }
        if(fixtureProducto){
            const id=fixtureProducto.get('id');
            await m.MovimientoInventario.destroy({where:{id_producto:id},transaction});
            await m.ReservaProducto.destroy({where:{id_producto:id},transaction});
            await m.Productos.destroy({where:{id,nombre:prefijo+'_concurrencia'},transaction});
        }
    });
    console.log('Fixtures de concurrencia eliminados; registros anteriores conservados.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(async()=>{try{await limpiar();}catch(e){console.error('No se pudieron limpiar fixtures '+prefijo+': '+e.message);process.exitCode=1;}await m.sequelize.close();});
