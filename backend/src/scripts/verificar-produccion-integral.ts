import '../load-env';
import assert from 'assert/strict';
import {createHash,randomUUID} from 'crypto';
import {QueryTypes,Transaction} from 'sequelize';
import {sequelize,User,Productor,Proveedor,Productos,Compra,CompraDetalle,MovimientoInventario} from '../models';
import {crearDescarguio,confirmarDescarguio,anularDescarguio,leerDesc} from '../servicios/descarguios.servicio';
import {guardarEtapa,confirmarEtapa,anularEtapa} from '../servicios/produccion-etapas.servicio';
import {guardarTransformacion,confirmarTransformacion,anularTransformacion} from '../servicios/produccion-transformaciones.servicio';
import {detalleLote,consultarLotes} from '../servicios/produccion-trazabilidad.servicio';
import {consultarReporteProduccion} from '../servicios/produccion-reportes.servicio';
import {ErrorDescarguio} from '../dtos/descarguio.dto';

async function huellas(){const result:Record<string,string>={};for(const table of (await sequelize.getQueryInterface().showAllTables()).map(String).sort()){
 const rows=await sequelize.query('SELECT * FROM `'+table.replace(/`/g,'``')+'`',{type:QueryTypes.SELECT});result[table]=createHash('sha256').update(rows.map(r=>JSON.stringify(r)).sort().join('\n')).digest('hex');}return result;}
async function insert(table:string,data:Record<string,any>,t:Transaction){const keys=Object.keys(data);const [id]=await sequelize.query(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(k=>':'+k).join(',')})`,{replacements:data,type:QueryTypes.INSERT,transaction:t});return Number(id);}

/** Recorrido completo con servicios reales; todos sus registros se revierten. */
async function recorrido(uid:number){
 const t=await sequelize.transaction({isolationLevel:Transaction.ISOLATION_LEVELS.READ_COMMITTED});
 try{
 const mark=randomUUID().slice(0,8),fecha='2026-11-05T12:00:00Z';
 const p=await Productor.create({nombre:'PRODUCTOR INTEGRAL DE PRUEBA '+mark,activo:true},{transaction:t}),pid=Number(p.get('id'));
 const proveedor=await Proveedor.create({nombre:'PROVEEDOR INTEGRAL DE PRUEBA '+mark,activo:true},{transaction:t});
 const producto=async(nombre:string,unidad_medida:string,stock:number)=>Number((await Productos.create({nombre:nombre+' '+mark,unidad_medida,stock},{transaction:t})).get('id'));
 const chala=await producto('CHALA INTEGRAL','Fanega',100.125),arroz=await producto('ARROZ INTEGRAL','Quintal',0),afrecho=await producto('AFRECHO INTEGRAL','Kilo',0),bolsa=await producto('BOLSA VACIA INTEGRAL','Unidad',20),envasado=await producto('ARROZ ENVASADO INTEGRAL','Unidad',0);
 const compra=await Compra.create({id_proveedor:proveedor.get('id'),id_productor:pid,fecha,total:5000,saldo_pendiente:5000,estado:'PENDIENTE',tipo_compra:'CHALA',anticipada:true,estado_recepcion:'COMPLETA',id_usuario:uid},{transaction:t});
 const det=await CompraDetalle.create({id_compra:compra.get('id'),id_producto:chala,descripcion:'Compra simulada ya recibida',unidad:'Fanega',cantidad:100.125,cantidad_recibida:100.125,precio_unitario:0,subtotal:5000},{transaction:t});
 await MovimientoInventario.create({id_producto:chala,tipo:'ENTRADA',cantidad:100.125,stock_resultante:100.125,origen:'COMPRA',origen_id:compra.get('id'),fecha,id_usuario:uid},{transaction:t});
 const stock=async(id:number)=>Number((await Productos.findByPk(id,{transaction:t}))!.get('stock'));
 const balances=async()=>Object.fromEntries((await leerDesc("SELECT unidad,SUM(cantidad_disponible) cantidad FROM produccion_lotes WHERE id_productor = :pid AND estado='ACTIVO' GROUP BY unidad",{pid},t)).map(r=>[r.unidad,Number(r.cantidad)]));
 const financiero=async()=>{const result:Record<string,unknown>={};for(const table of ['compras','ventas','cobranzas','pagos_proveedor','movimientos_caja']){
  result[table]=await leerDesc('SELECT * FROM '+table,{},t);}return result;};
 const finAntes=await financiero();
 for(const modalidad of ['COMPRA','SERVICIO'] as const){
  const snapshots=[await stock(chala),await stock(arroz),await stock(afrecho),await stock(bolsa),await stock(envasado)];
  let d=await crearDescarguio({fecha,modalidad,id_productor:pid,id_producto:chala,id_compra_detalle:modalidad==='COMPRA'?Number(det.get('id')):null,boleta:'INTEGRAL-'+mark+'-'+modalidad,variedad:'MAC-18',cantidad:100.125,unidad:'Fanega',chofer:'CHOFER ESCRITO MANUALMENTE',clave_creacion:randomUUID()},uid,t);
  d=await confirmarDescarguio(d.id,{version:d.version,clave_confirmacion:randomUUID()},uid,t);assert.equal(await stock(chala),snapshots[0]);
  let s=await guardarEtapa('SECADO',null,{fecha,origenes:[{id_lote:d.id_lote,cantidad:60.125}],secadora:'SECADORA MANUAL',inicio:fecha,fin:'2026-11-06T00:00:00Z',humedad_entrada:18.5,humedad_salida:11.3,clave_creacion:randomUUID()},uid,t);
  s=await confirmarEtapa('SECADO',s.id,{version:s.version,clave_confirmacion:randomUUID()},uid,t);
  let g=await guardarEtapa('GUARDADO',null,{fecha:'2026-11-06T01:00:00Z',origenes:[{id_lote:s.origenes[0].id_lote_resultado,cantidad:40.125}],destino_nombre:'ALMACEN INTEGRAL '+mark,ubicacion_detalle:'N-1 / A-2',clave_creacion:randomUUID()},uid,t);
  g=await confirmarEtapa('GUARDADO',g.id,{version:g.version,clave_confirmacion:randomUUID()},uid,t);
  assert.equal(await stock(chala),snapshots[0]);assert.equal((await balances()).Fanega,100.125);
  let pr=await guardarTransformacion('PROCESADO',null,{fecha:'2026-11-06T02:00:00Z',origenes:[{id_lote:g.origenes[0].id_lote_resultado,cantidad:30.125}],peso_entrada_kg:1000,resultados:[{id_producto:arroz,clasificacion:'Entero',cantidad:10,unidad:'Quintal',peso_real_kg:460},{id_producto:afrecho,clasificacion:'Afrecho',cantidad:3,unidad:'Kilo'}],clave_creacion:randomUUID()},uid,t);
  pr=await confirmarTransformacion('PROCESADO',pr.id,{version:pr.version,clave_confirmacion:randomUUID()},uid,t);
  let e=await guardarTransformacion('ENVASADO',null,{fecha:'2026-11-06T03:00:00Z',origenes:[{id_lote:pr.resultados[0].id_lote_resultado,cantidad:2}],id_producto_empaque:bolsa,id_producto_destino:envasado,presentacion:'ENVASE DE PRUEBA',numero_bolsas:2,contenido_bolsa_kg:46,equivalencia_kg_origen:46,origen_equivalencia:'Pesaje explícito de prueba',clave_creacion:randomUUID()},uid,t);
  e=await confirmarTransformacion('ENVASADO',e.id,{version:e.version,clave_confirmacion:randomUUID()},uid,t);
  assert.equal(await stock(chala),snapshots[0]-(modalidad==='COMPRA'?30.125:0));assert.equal(await stock(arroz),snapshots[1]+(modalidad==='COMPRA'?8:0));assert.equal(await stock(afrecho),snapshots[2]+(modalidad==='COMPRA'?3:0));assert.equal(await stock(envasado),snapshots[4]+(modalidad==='COMPRA'?2:0));assert.equal(await stock(bolsa),snapshots[3]-2);
  const detalle=await detalleLote(e.lotes[0].id,t);assert.equal(detalle.operaciones.length,5);assert(detalle.relacionados.every(l=>modalidad==='COMPRA'?l.id_propietario==null:Number(l.id_propietario)===pid));
  const q={id_productor:pid,modalidad,estado:'CONFIRMADO',limit:100};for(const reporte of ['descarguios','secados','guardados','procesados','envasados'])assert.equal((await consultarReporteProduccion(reporte,q,t)).total,1);
  assert.deepEqual(await financiero(),finAntes,'La producción no crea ni altera operaciones financieras');
  await assert.rejects(()=>anularEtapa('GUARDADO',g.id,{version:g.version,motivo:'No puede anularse con pilado dependiente'},uid,t),e=>e instanceof ErrorDescarguio);
  await anularTransformacion('ENVASADO',e.id,{version:e.version,motivo:'Reversión de recorrido integral'},uid,t);await anularTransformacion('PROCESADO',pr.id,{version:pr.version,motivo:'Reversión de recorrido integral'},uid,t);
  await anularEtapa('GUARDADO',g.id,{version:g.version,motivo:'Reversión de recorrido integral'},uid,t);await anularEtapa('SECADO',s.id,{version:s.version,motivo:'Reversión de recorrido integral'},uid,t);await anularDescarguio(d.id,{version:d.version,motivo:'Reversión de recorrido integral'},uid,t);
  assert.deepEqual([await stock(chala),await stock(arroz),await stock(afrecho),await stock(bolsa),await stock(envasado)],snapshots);
  assert.equal((await consultarLotes({id_productor:pid,modalidad,estado:'ACTIVO'},t)).total,0);assert.deepEqual(await financiero(),finAntes);
  console.log(JSON.stringify({recorrido:modalidad,cincoEtapas:'OK',parciales:'OK',propiedad:'OK',trazabilidadYReportes:'OK',reversionCompleta:'OK',finanzas:'sin cambios'}));
 }
 }finally{await t.rollback();}
}

/** Dos conexiones reales compiten por un lote aislado. Limpieza obligatoria por IDs exactos. */
async function concurrencia(uid:number){
 const mark=randomUUID().slice(0,8),operaciones:number[]=[],productos:number[]=[],productores:number[]=[];let root=0;
 try{
  await sequelize.transaction(async t=>{
   const p=await Productor.create({nombre:'CONCURRENCIA DE PRUEBA '+mark,activo:true},{transaction:t});productores.push(Number(p.get('id')));
   const pr=await Productos.create({nombre:'CHALA CONCURRENCIA DE PRUEBA '+mark,unidad_medida:'Fanega',stock:0},{transaction:t});productos.push(Number(pr.get('id')));
   for(const tipo of ['DESCARGUIO','SECADO','SECADO'])operaciones.push(await insert('produccion_operaciones',{codigo:'CC-'+mark+'-'+operaciones.length,tipo,fecha:'2026-11-05 10:00:00',estado:tipo==='DESCARGUIO'?'CONFIRMADO':'BORRADOR',modalidad:'SERVICIO',id_propietario:productores[0],id_productor:productores[0],id_usuario:uid,version:0,created_at:new Date(),updated_at:new Date()},t));
   root=await insert('produccion_lotes',{codigo:'CC-'+mark+'-ORIGEN',id_operacion_origen:operaciones[0],id_producto:productos[0],modalidad:'SERVICIO',id_propietario:productores[0],id_productor:productores[0],variedad:'MAC-18',cantidad_inicial:100,cantidad_disponible:100,unidad:'Fanega',etapa:'DESCARGUIO',estado_fisico:'CHALA_HUMEDA',estado:'ACTIVO',id_usuario:uid,version:0,created_at:new Date(),updated_at:new Date()},t);
   for(const id of operaciones.slice(1)){
    await insert('produccion_secados',{id_operacion:id,secadora:'PRUEBA',inicio:'2026-11-05 10:00:00',fin:'2026-11-05 20:00:00',humedad_salida:11},t);
    await insert('produccion_etapa_origenes',{id_operacion:id,id_lote:root,cantidad:80},t);
   }
  });
  const r=await Promise.allSettled(operaciones.slice(1).map(id=>confirmarEtapa('SECADO',id,{version:0,clave_confirmacion:randomUUID()},uid)));
  assert.equal(r.filter(x=>x.status==='fulfilled').length,1,'Solo una confirmación puede consumir 80 de 100');
  const error=r.find(x=>x.status==='rejected') as PromiseRejectedResult;assert(error.reason instanceof ErrorDescarguio&&error.reason.status===409);
  const [balance]=await leerDesc('SELECT cantidad_disponible FROM produccion_lotes WHERE id = :id',{id:root});assert.equal(Number(balance.cantidad_disponible),20);
  const [salidas]=await leerDesc("SELECT COUNT(*) n,SUM(cantidad) cantidad FROM produccion_movimientos WHERE id_lote = :id AND tipo='SALIDA'",{id:root});assert.equal(Number(salidas.n),1);assert.equal(Number(salidas.cantidad),80);
  console.log(JSON.stringify({concurrencia:'dos conexiones reales',confirmaciones:1,conflictos409:1,saldoOrigen:20,sinSobreconsumo:true}));
 }finally{
  await sequelize.transaction(async t=>{
   // Solo se borran fixtures de esta prueba. Nunca se incluyen IDs comerciales existentes.
   if(operaciones.length){for(const table of ['produccion_auditoria','produccion_movimientos','produccion_operacion_lotes','produccion_etapa_origenes','produccion_secados'])await sequelize.query('DELETE FROM '+table+' WHERE id_operacion IN (:ids)',{replacements:{ids:operaciones},transaction:t});
    await sequelize.query('DELETE FROM produccion_lotes WHERE id_operacion_origen IN (:ids)',{replacements:{ids:operaciones},transaction:t});await sequelize.query('DELETE FROM produccion_operaciones WHERE id IN (:ids)',{replacements:{ids:operaciones},transaction:t});}
   if(productos.length)await Productos.destroy({where:{id:productos},transaction:t});if(productores.length)await Productor.destroy({where:{id:productores},transaction:t});
  });
 }
}
async function main(){
 if(process.env.NODE_ENV!=='development'||sequelize.getDatabaseName()!=='db_empresa_rojas')throw new Error('Esta verificación solo admite db_empresa_rojas en desarrollo.');
 await sequelize.authenticate();const antes=await huellas();const u=await User.findOne({where:{activo:true,eliminado:false}});assert(u);
 try{await recorrido(Number(u.get('id')));await concurrencia(Number(u.get('id')));}finally{assert.deepEqual(await huellas(),antes,'Todas las tablas deben recuperar exactamente sus filas originales.');}
 console.log(JSON.stringify({huellas:'todas las tablas sin cambios',fixturesPersistidos:0}));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>sequelize.close());
