import '../load-env';
import assert from 'assert/strict';
import {randomUUID} from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {QueryTypes,Transaction} from 'sequelize';
import {sequelize,User,Productor,Productos} from '../models';
import {consultarLotes,detalleLote,existenciasProductor} from '../servicios/produccion-trazabilidad.servicio';
import {consultarReporteProduccion,hojaReporteProduccion,reportesProduccion} from '../servicios/produccion-reportes.servicio';
import {bufferReportePdf} from '../utils/exportar';
async function insert(table:string,data:Record<string,any>,t:Transaction){const keys=Object.keys(data);const [id]=await sequelize.query(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(k=>':'+k).join(',')})`,{replacements:data,type:QueryTypes.INSERT,transaction:t});return Number(id);}
async function main(){
 if(process.env.NODE_ENV!=='development')throw new Error('Solo en desarrollo.');await sequelize.authenticate();const t=await sequelize.transaction();
 try{
 const u=await User.findOne({where:{activo:true,eliminado:false},transaction:t});assert(u);const uid=Number(u.get('id')),mark=randomUUID().slice(0,8);
 const p=await Productor.create({nombre:'CLIENTE DE PRUEBA '+mark+' CON NOMBRE EXTENSO PARA COMPROBAR EL AJUSTE COMPLETO DEL TEXTO EN LOS REPORTES',activo:true},{transaction:t}),pid=Number(p.get('id'));
 const a=await Productos.create({nombre:'CHALA DE PRUEBA '+mark,unidad_medida:'Kilo'},{transaction:t}),b=await Productos.create({nombre:'ARROZ DE PRUEBA '+mark,unidad_medida:'Quintal'},{transaction:t}),dest=await Productos.create({nombre:'ENVASADO DE PRUEBA '+mark,unidad_medida:'Unidad'},{transaction:t});
 let seq=0;const op=async(tipo:string,date='2026-11-05 10:00:00')=>insert('produccion_operaciones',{codigo:tipo+'-TEST-'+mark+'-'+(++seq),tipo,fecha:date,estado:'CONFIRMADO',modalidad:'SERVICIO',id_propietario:pid,id_productor:pid,id_usuario:uid,version:0,created_at:new Date(),updated_at:new Date()},t);
 const lot=async(o:number,qty:number,disp:number,etapa:string,producto=Number(a.get('id')),unidad='Kilo')=>insert('produccion_lotes',{codigo:'LOTE-TEST-'+mark+'-'+(++seq),id_operacion_origen:o,id_producto:producto,modalidad:'SERVICIO',id_propietario:pid,id_productor:pid,variedad:'MAC-18',cantidad_inicial:qty,cantidad_disponible:disp,unidad,etapa,estado_fisico:etapa==='DESCARGUIO'?'CHALA_HUMEDA':['SECADO','GUARDADO'].includes(etapa)?'CHALA_SECA':etapa,estado:disp?'ACTIVO':'AGOTADO',id_usuario:uid,version:0,created_at:new Date(),updated_at:new Date()},t);
 const origin=async(o:number,l:number,q:number,out?:number)=>insert('produccion_etapa_origenes',{id_operacion:o,id_lote:l,cantidad:q,id_lote_resultado:out||null},t);
 const d=await op('DESCARGUIO','2026-11-01 08:00:00'),ld=await lot(d,1000,200,'DESCARGUIO');
 await insert('produccion_descarguios',{id_operacion:d,boleta:'BOLETA-TEST-'+mark,id_producto:a.get('id'),cantidad:1000,unidad:'Kilo',variedad:'MAC-18',humedad_entrada:20},t);
 const s1=await op('SECADO'),ls1=await lot(s1,500,0,'SECADO'),s2=await op('SECADO'),ls2=await lot(s2,300,0,'SECADO');
 for(const [o,l,qty]of [[s1,ls1,500],[s2,ls2,300]]){await insert('produccion_secados',{id_operacion:o,secadora:'SECADORA DE PRUEBA',humedad_entrada:20,humedad_salida:11},t);await origin(o,ld,qty,l);}
 const g=await op('GUARDADO'),lg1=await lot(g,500,0,'GUARDADO'),lg2=await lot(g,300,100,'GUARDADO');await insert('produccion_guardados',{id_operacion:g,destino_nombre:'ALMACÉN DE PRUEBA'},t);await origin(g,ls1,500,lg1);await origin(g,ls2,300,lg2);
 const pr=await op('PROCESADO'),lr=await lot(pr,10,8,'PROCESADO',Number(b.get('id')),'Quintal');await insert('produccion_procesados',{id_operacion:pr,peso_entrada_kg:700,peso_salida_kg:420},t);await origin(pr,lg1,500);await origin(pr,lg2,200);
 await insert('produccion_procesado_detalles',{id_operacion:pr,id_producto:b.get('id'),id_lote_resultado:lr,clasificacion:'Entero',cantidad:10,unidad:'Quintal',peso_real_kg:420},t);
 const e=await op('ENVASADO'),le=await lot(e,2,2,'ENVASADO',Number(dest.get('id')),'Unidad');await origin(e,lr,2);await insert('produccion_envasados',{id_operacion:e,id_producto_destino:dest.get('id'),id_lote_resultado:le,presentacion:'Presentación de prueba',numero_bolsas:2,contenido_bolsa_kg:42,peso_total_kg:84,cantidad_destino:2,unidad_destino:'Unidad'},t);
 const q={id_productor:pid,fecha_desde:'2026-11-01',fecha_hasta:'2026-11-01',limit:100};
 const lista=await consultarLotes(q,t);assert.equal(lista.total,7);assert.equal(new Set(lista.items.map(l=>Number(l.id))).size,7);
 assert.equal((await consultarLotes({...q,fecha_desde:'2026-11-05',fecha_hasta:'2026-11-05'},t)).total,0,'Filtrar por recepción, no por fecha de transformación');
 assert.equal((await consultarLotes({...q,buscar:'BOLETA-TEST-'+mark},t)).total,7);
 assert.equal((await consultarLotes({...q,propiedad:'PROPIO'},t)).total,0);
 const det=await detalleLote(le,t);assert.equal(det.operaciones.length,6);assert.equal(det.operaciones.find(o=>Number(o.id)===pr)?.entradas.length,2);assert.equal(det.conciliacion,null);
 const root=await detalleLote(ld,t);assert.equal(root.relacionados.length,7,'Todas las ramas');
 const exist=await existenciasProductor(q,true,t);assert.equal(exist.resumen.saldos.length,3);assert.equal(Number(exist.resumen.saldos.find(s=>s.unidad==='Kilo')?.cantidad),300);
 assert.equal((await consultarLotes({...q,clasificacion:'Entero'},t)).total,2,'La presentación conserva la clasificación');
 await assert.rejects(()=>consultarLotes({...q,propiedad:'INVENTADA'},t));await assert.rejects(()=>detalleLote(-1,t));
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'codex-produccion-fases-7-8-'));
 for(const tipo of Object.keys(reportesProduccion)){
  const filtro={id_productor:pid,limit:1,columna:0,direccion:1};const screen=await consultarReporteProduccion(tipo,filtro,t),excel=await hojaReporteProduccion(tipo,filtro,'xlsx',t),pdf=await hojaReporteProduccion(tipo,filtro,'pdf',t);
  assert.equal(screen.total,excel.filas.length);assert.deepEqual(screen.items[0]?.valores,excel.filas[0]);assert.equal(screen.items.length,1);
  if(tipo==='secados')assert.equal(screen.total,2);
  const doc=await bufferReportePdf([pdf]);fs.writeFileSync(path.join(dir,tipo+'.pdf'),doc.buffer);console.log(JSON.stringify({tipo,paginas:doc.paginas,filas:excel.filas.length}));
 }
 const h=await hojaReporteProduccion('rendimiento',{id_productor:pid},'pdf',t);h.filas=Array.from({length:65},(_,i)=>h.filas[0].map((v,j)=>j===0?i+1:v));
 const long=await bufferReportePdf([h]);assert(long.paginas>1);fs.writeFileSync(path.join(dir,'multipagina.pdf'),long.buffer);
 console.log(JSON.stringify({archivos:dir,ramasYUniones:'OK',saldosSinDuplicados:'OK',periodoRecepcion:'OK',propiedadYClasificacion:'OK',paginacionYExportacionCompleta:'OK',pdfMultipagina:long.paginas}));
 }finally{await t.rollback();}
 console.log('Todos los datos de prueba revertidos. Sin escrituras comerciales.');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>sequelize.close());
