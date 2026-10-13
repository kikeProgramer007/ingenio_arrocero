require('reflect-metadata');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const m = require('../dist/models');
const { getJwtSecret } = require('../dist/utils/jwt');
const limpiarMarca = process.argv.find(a=>a.startsWith('--limpiar='))?.slice('--limpiar='.length);
const marca = limpiarMarca || 'TEST_API_DESPACHOS_' + crypto.randomUUID();
if (!/^TEST_API_DESPACHOS_[0-9a-f-]{36}$/.test(marca)) throw new Error('Marca de prueba invalida');
let producto; let checks = 0;
function check(v,msg) { assert.ok(v,msg); checks++; console.log('OK: '+msg); }
async function main() {
    if(limpiarMarca){ producto=await m.Productos.findOne({where:{nombre:marca}});return; }
    const usuario = await m.User.findOne({where:{activo:true,eliminado:false},attributes:['id','username']});
    const cliente = await m.Cliente.findOne({where:{activo:true},attributes:['id']});
    assert.ok(usuario && cliente);
    const token = jwt.sign({id:usuario.get('id'),username:usuario.get('username')},getJwtSecret(),{expiresIn:'5m'});
    const base = process.env.TEST_API_URL || 'http://127.0.0.1:3001';
    async function api(ruta,datos,method=datos?'POST':'GET') {
        const r=await fetch(base+ruta,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(datos?{body:JSON.stringify(datos)}:{})});
        const body=r.headers.get('content-type')?.includes('json')?await r.json():Buffer.from(await r.arrayBuffer());
        return {status:r.status,body};
    }
    assert.equal((await api('/api/despachos/config')).body.habilitado,true);
    producto=await m.Productos.create({nombre:marca,stock:20,unidad_medida:'Quintal',precio_venta:5});
    const id=Number(producto.get('id'));
    const payload=(cantidad,extras={})=>({id_cliente:Number(cliente.get('id')),clave:crypto.randomUUID(),entrega:'POSTERIOR',observacion:marca,lineas:[{id_producto:id,cantidad,precio_unitario:5}],...extras});
    const solicitud=payload(5);
    const doble=await Promise.all([api('/api/ventas',solicitud),api('/api/ventas',solicitud)]);
    check(doble.every(r=>[200,201].includes(r.status))&&doble[0].body.data.id===doble[1].body.data.id,'API: venta duplicada devuelve el mismo registro');
    const venta=doble[0].body.data;
    check(venta.estado_despacho==='PENDIENTE'&&venta.detalles[0].pendiente===5&&venta.saldo_pendiente===25,'API: venta a credito reserva sin salida fisica');
    check(Number((await m.Productos.findByPk(id)).get('stock'))===20,'API: guardar venta no baja fisico');
    const lista=await api('/api/despachos?numero='+venta.id+'&limite=1');
    check(lista.status===200&&lista.body.total===1&&lista.body.data[0].detalles[0].pendiente===5,'API: paginacion, filtros y detalles de reservas');
    const retiro={clave:crypto.randomUUID(),persona_retira:'Persona prueba API',lineas:[{id_detalle:venta.detalles[0].id,cantidad:5}]};
    const salida=await api('/api/despachos/ventas/'+venta.id,retiro);
    check(salida.status===200,'API: despacho confirmado');
    const actual=(await api('/api/ventas/'+venta.id)).body;
    check(actual.estado_despacho==='COMPLETO'&&actual.estado==='PENDIENTE'&&actual.saldo_pendiente===25,'API: despacho no modifica deuda');
    const nota=await api('/api/despachos/'+salida.body.data.id+'/nota');
    check(nota.status===200&&nota.body.subarray(0,4).toString()==='%PDF','API: nota de entrega real y reimpresion');
    check((await api('/api/ventas/'+venta.id+'/anular',{},'PUT')).status===409,'API: anular venta entregada bloqueado');
    const pendiente=await api('/api/ventas',payload(2));
    assert.equal(pendiente.status,201,JSON.stringify(pendiente.body));
    check((await api('/api/ventas/'+pendiente.body.data.id+'/anular',{},'PUT')).status===200&&Number((await m.Productos.findByPk(id)).get('stock'))===15,'API: anulacion libera reserva sin reponer fisico');
    const parcial=await api('/api/ventas',payload(2,{entrega:'PARCIAL',persona_retira:'Retiro inicial prueba API',lineas:[{id_producto:id,cantidad:2,precio_unitario:5,entregar_ahora:1}]}));
    check(parcial.status===201&&parcial.body.data.estado_despacho==='PARCIAL'&&parcial.body.data.detalles[0].entregado===1&&parcial.body.data.detalles[0].pendiente===1,'API: venta y despacho inicial parcial atomicos');
    const historial=await api('/api/despachos/ventas/'+parcial.body.data.id);
    check(historial.status===200&&historial.body.length===1,'API: historial de despacho inicial');
    const antes=await m.Venta.count();
    check((await api('/api/ventas',payload(100))).status===409&&await m.Venta.count()===antes,'API: sobreventa revierte toda la operacion');
    const servicio=await api('/api/ventas',payload(1,{lineas:[{descripcion:'Servicio prueba API',cantidad:1,precio_unitario:5}]}));
    check(servicio.status===201&&servicio.body.data.estado_despacho==='NO_APLICA','API: servicio sin reserva ni despacho');
    console.log(checks+' comprobaciones HTTP contra .env.');
}
async function limpiar() {
    const observaciones={ [Op.in]: [marca, marca+' · Anulada'] };
    const ids=(await m.Venta.findAll({where:{observacion:observaciones},attributes:['id']})).map(v=>v.get('id'));
    await m.sequelize.transaction(async transaction=>{
        if(ids.length){
            const where={id_venta:{[Op.in]:ids}};
            await m.Despacho.destroy({where,transaction});await m.ReservaVenta.destroy({where,transaction});await m.VentaEntrega.destroy({where,transaction});await m.VentaDetalle.destroy({where,transaction});
            await m.Venta.destroy({where:{id:{[Op.in]:ids},observacion:observaciones},transaction});
        }
        if(producto){
            const id=producto.get('id');
            await m.MovimientoInventario.destroy({where:{id_producto:id},transaction});await m.ReservaProducto.destroy({where:{id_producto:id},transaction});
            await m.Productos.destroy({where:{id,nombre:marca},transaction});
        }
    });
    console.log('Fixtures HTTP limpiados; no se modificaron cobranzas ni cajas existentes.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(async()=>{try{await limpiar();}catch(e){console.error('Error limpiando '+marca+': '+e.message);process.exitCode=1;}await m.sequelize.close();});
