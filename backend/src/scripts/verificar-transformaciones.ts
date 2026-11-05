import '../load-env';
import assert from 'assert/strict';
import { createHash, randomUUID } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { QueryTypes, Transaction } from 'sequelize';
import { sequelize, Productor, Productos, User, ReservaProducto } from '../models';
import { leerDesc } from '../servicios/descarguios.servicio';
import { guardarTransformacion, confirmarTransformacion, anularTransformacion, obtenerTransformacion } from '../servicios/produccion-transformaciones.servicio';
import { listarTransformacion, filasTransformacion, opcionesTransformacion, hojaTransformacion } from '../servicios/produccion-transformaciones-consulta.servicio';
import { validarTransformacion } from '../dtos/produccion-transformacion.dto';
import { ErrorDescarguio } from '../dtos/descarguio.dto';
import { bufferReportePdf } from '../utils/exportar';
async function huella(){const h=createHash('sha256');for(const table of (await sequelize.getQueryInterface().showAllTables()).map(String).sort())h.update(table).update((await sequelize.query('SELECT * FROM `'+table.replace(/`/g,'``')+'`',{type:QueryTypes.SELECT})).map(r=>JSON.stringify(r)).sort().join('\n'));return h.digest('hex');}
async function insertar(table:string,data:Record<string,any>,t:Transaction){const keys=Object.keys(data),[id]=await sequelize.query(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(k=>':'+k).join(',')})`,{replacements:data,transaction:t,type:QueryTypes.INSERT});return Number(id);}
async function main(){
    if(process.env.NODE_ENV!=='development')throw new Error('Solo se permite verificar en desarrollo.');await sequelize.authenticate();const antes=await huella();
    const t=await sequelize.transaction({isolationLevel:Transaction.ISOLATION_LEVELS.READ_COMMITTED});let files:string[]=[];
    try{
        const user=await User.findOne({where:{activo:true,eliminado:false},transaction:t});assert(user);const uid=Number(user.get('id')),mark=randomUUID().slice(0,8),fecha='2026-11-05T18:00:00.000Z';
        const productor=await Productor.create({nombre:'PRODUCTOR DE PRUEBA '+mark+' CON NOMBRE EXTENSO PARA COMPROBAR LOS TEXTOS COMPLETOS Y SALTOS DE LINEA EN REPORTES OPERATIVOS',activo:true},{transaction:t}),pid=Number(productor.get('id'));
        const product=async(nombre:string,unidad:string,stock:number)=>{const p=await Productos.create({nombre:nombre+' PRUEBA '+mark,unidad_medida:unidad,stock},{transaction:t});return Number(p.get('id'));};
        const chala=await product('ARROZ EN CHALA','Fanega',200.125),pulido=await product('ARROZ ENTERO','Quintal',10),granillo=await product('GRANILLO','Quintal',0),afrecho=await product('AFRECHO','Kilo',0),bag=await product('BOLSA VACIA','Unidad',200),dest=await product('ARROZ ENVASADO','Unidad',3),destQ=await product('ARROZ PRESENTACION PERSONALIZADA','Quintal',0);
        const stock=async(id:number)=>{const p=await Productos.findByPk(id,{transaction:t});return Number(p!.get('stock'));};
        const disponible=async(id:number)=>Number((await leerDesc('SELECT cantidad_disponible n FROM produccion_lotes WHERE id = :id',{id},t))[0].n);
        const finance=async()=>{const result=[];for(const table of ['compras','ventas','pagos_proveedor','movimientos_caja'])result.push((await leerDesc(`SELECT COUNT(*) n FROM ${table}`,{},t))[0].n);return result;};
        const financeBefore=await finance();
        const seed=async(modalidad:'COMPRA'|'SERVICIO')=>{const op=await insertar('produccion_operaciones',{codigo:'G-PRUEBA-'+modalidad+'-'+mark,tipo:'GUARDADO',fecha:'2026-11-05 12:00:00',estado:'CONFIRMADO',modalidad,id_propietario:modalidad==='COMPRA'?null:pid,id_productor:pid,id_usuario:uid,version:0,created_at:new Date(),updated_at:new Date()},t);
            return insertar('produccion_lotes',{codigo:'LOTE-PRUEBA-'+modalidad+'-'+mark,id_operacion_origen:op,id_producto:chala,modalidad,id_propietario:modalidad==='COMPRA'?null:pid,id_productor:pid,variedad:'MAC-18 PRUEBA',cantidad_inicial:100.125,cantidad_disponible:100.125,unidad:'Fanega',etapa:'GUARDADO',estado_fisico:'CHALA_SECA',estado:'ACTIVO',id_usuario:uid,version:0,created_at:new Date(),updated_at:new Date()},t);};
        const own=await seed('COMPRA'),third=await seed('SERVICIO');
        const rejected=(fn:()=>Promise<unknown>)=>assert.rejects(fn,(e:unknown)=>e instanceof ErrorDescarguio);
        const process={fecha,origenes:[{id_lote:own,cantidad:40.125}],maquina:'LINEA MANUAL',peso_entrada_kg:3000,merma_medida:1,unidad_merma:'Kilo',justificacion_merma:'Pérdida medida de prueba',resultados:[
            {id_producto:pulido,clasificacion:'Entero',cantidad:30.125,unidad:'Quintal',peso_real_kg:1385.75},{id_producto:granillo,clasificacion:'Granillo',cantidad:5.25,unidad:'Quintal',peso_real_kg:241.5},{id_producto:afrecho,clasificacion:'Afrecho',cantidad:2,unidad:'Kilo'}]};
        for(const patch of [{origenes:[{id_lote:own,cantidad:-1}]},{resultados:[{id_producto:pulido,cantidad:0,unidad:'Quintal'}]},{peso_entrada_kg:'1.1234'}])assert.throws(()=>validarTransformacion('PROCESADO',{...process,...patch},true));
        let draft=await guardarTransformacion('PROCESADO',null,{fecha,resultados:[],origenes:[],clave_creacion:randomUUID()},uid,t);assert.equal(draft.estado,'BORRADOR');assert.equal(draft.lotes.length,0);
        const key=randomUUID();let p=await guardarTransformacion('PROCESADO',null,{...process,clave_creacion:key},uid,t);assert.equal((await guardarTransformacion('PROCESADO',null,{...process,clave_creacion:key},uid,t)).id,p.id);
        assert.equal(await stock(chala),200.125);assert.equal(await disponible(own),100.125);
        await rejected(()=>guardarTransformacion('PROCESADO',p.id,{...process,version:123456},uid,t));
        let invalid=await guardarTransformacion('PROCESADO',null,{...process,origenes:[{id_lote:own,cantidad:101}],clave_creacion:randomUUID()},uid,t);await rejected(()=>confirmarTransformacion('PROCESADO',invalid.id,{version:invalid.version,clave_confirmacion:randomUUID()},uid,t));
        await rejected(()=>guardarTransformacion('PROCESADO',null,{...process,resultados:[{id_producto:pulido,clasificacion:'Mal',cantidad:1,unidad:'Kilo'}],clave_creacion:randomUUID()},uid,t));
        await rejected(()=>guardarTransformacion('PROCESADO',null,{...process,origenes:[{id_lote:own,cantidad:1},{id_lote:third,cantidad:1}],clave_creacion:randomUUID()},uid,t));
        const confirmedKey=randomUUID();p=await confirmarTransformacion('PROCESADO',p.id,{version:p.version,clave_confirmacion:confirmedKey},uid,t);assert.equal(p.estado,'CONFIRMADO');assert.equal(p.lotes.length,3);
        assert.equal(await stock(chala),160);assert.equal(await disponible(own),60);assert.equal(await stock(pulido),40.125);assert.equal(await stock(granillo),5.25);assert.equal(await stock(afrecho),2);
        assert(Math.abs(p.resumen.rendimiento-1629.25/3000*100)<0.000001);
        const ledgerCount=async(op:number)=>Number((await leerDesc('SELECT COUNT(*) n FROM produccion_inventario_vinculos WHERE id_operacion = :id',{id:op},t))[0].n);
        assert.equal(await ledgerCount(p.id),4);await confirmarTransformacion('PROCESADO',p.id,{version:0,clave_confirmacion:confirmedKey},uid,t);assert.equal(await ledgerCount(p.id),4);
        await rejected(()=>guardarTransformacion('PROCESADO',p.id,{...process,version:p.version},uid,t));
        const pulidoLot=Number(p.resultados[0].id_lote_resultado);
        let e=await guardarTransformacion('ENVASADO',null,{fecha:'2026-11-05T19:00:00Z',origenes:[{id_lote:pulidoLot,cantidad:4}],id_producto_empaque:bag,id_producto_destino:dest,presentacion:'Envase personalizado de prueba',numero_bolsas:4,contenido_bolsa_kg:46,clave_creacion:randomUUID()},uid,t);
        await rejected(()=>confirmarTransformacion('ENVASADO',e.id,{version:e.version,clave_confirmacion:randomUUID()},uid,t)); // falta equivalencia
        e=await guardarTransformacion('ENVASADO',e.id,{...e,equivalencia_kg_origen:46,origen_equivalencia:'Medición explícita de prueba',version:e.version},uid,t);
        await rejected(()=>anularTransformacion('PROCESADO',p.id,{version:p.version,motivo:'No debe anular con un envasado dependiente'},uid,t));
        await Productos.update({stock:0},{where:{id:bag},transaction:t});
        const beforeRice=await stock(pulido),beforeLot=await disponible(pulidoLot),beforeMoves=await ledgerCount(e.id);
        await rejected(()=>confirmarTransformacion('ENVASADO',e.id,{version:e.version,clave_confirmacion:randomUUID()},uid,t));
        assert.equal(await stock(pulido),beforeRice);assert.equal(await disponible(pulidoLot),beforeLot);assert.equal(await ledgerCount(e.id),beforeMoves); // rollback del consumo previo al fallo de bolsas
        await Productos.update({stock:200},{where:{id:bag},transaction:t});
        const eKey=randomUUID();e=await confirmarTransformacion('ENVASADO',e.id,{version:e.version,clave_confirmacion:eKey},uid,t);
        assert.equal(await stock(pulido),36.125);assert.equal(await disponible(pulidoLot),26.125);assert.equal(await stock(bag),196);assert.equal(await stock(dest),7);assert.equal(Number(e.peso_total_kg),184);assert.equal(Number(e.cantidad_destino),4);assert.equal(e.lotes[0].unidad,'Unidad');
        await confirmarTransformacion('ENVASADO',e.id,{version:0,clave_confirmacion:eKey},uid,t);assert.equal(await stock(bag),196);assert.equal(await ledgerCount(e.id),3);
        // Otra unidad de destino exige equivalencia propia; nunca se asume la del origen.
        let custom=await guardarTransformacion('ENVASADO',null,{...e,origenes:[{id_lote:pulidoLot,cantidad:1}],id_producto_destino:destQ,numero_bolsas:1,equivalencia_kg_destino:null,clave_creacion:randomUUID()},uid,t);
        await rejected(()=>confirmarTransformacion('ENVASADO',custom.id,{version:custom.version,clave_confirmacion:randomUUID()},uid,t));
        custom=await guardarTransformacion('ENVASADO',custom.id,{...custom,equivalencia_kg_destino:46,version:custom.version},uid,t);custom=await confirmarTransformacion('ENVASADO',custom.id,{version:custom.version,clave_confirmacion:randomUUID()},uid,t);assert.equal(Number(custom.cantidad_destino),1);assert.equal(await stock(destQ),1);
        await anularTransformacion('ENVASADO',custom.id,{version:custom.version,motivo:'Reversión del envase personalizado'},uid,t);
        // Servicio: las salidas y resultados pertenecen al productor, solo se consumen bolsas propias.
        let tp=await guardarTransformacion('PROCESADO',null,{fecha,origenes:[{id_lote:third,cantidad:12.5}],resultados:[{id_producto:pulido,clasificacion:'Entero de tercero',cantidad:8,unidad:'Quintal'}],clave_creacion:randomUUID()},uid,t);
        tp=await confirmarTransformacion('PROCESADO',tp.id,{version:tp.version,clave_confirmacion:randomUUID()},uid,t);assert.equal(tp.modalidad,'SERVICIO');assert.equal(Number(tp.id_propietario),pid);assert.equal(tp.resumen.rendimiento,null);assert.equal(await ledgerCount(tp.id),0);assert.equal(await stock(pulido),36.125);assert.equal(await stock(chala),160);
        let te=await guardarTransformacion('ENVASADO',null,{...e,origenes:[{id_lote:tp.resultados[0].id_lote_resultado,cantidad:2}],numero_bolsas:2,clave_creacion:randomUUID()},uid,t);te=await confirmarTransformacion('ENVASADO',te.id,{version:te.version,clave_confirmacion:randomUUID()},uid,t);
        assert.equal(await stock(pulido),36.125);assert.equal(await stock(dest),7);assert.equal(await stock(bag),194);assert.equal(await ledgerCount(te.id),1);assert.equal(Number(te.id_propietario),pid);
        console.log('Stock propio, terceros, equivalencias, bolsas, parciales e idempotencia: OK');
        // Resúmenes, filtros y exportación no se limitan a la página visible.
        for(let i=0;i<11;i++)await guardarTransformacion('PROCESADO',null,{...process,clave_creacion:randomUUID()},uid,t);
        const q={id_productor:pid,estado:'BORRADOR',variedad:'MAC-18 PRUEBA',modalidad:'COMPRA',orden:'cantidad',limit:10};
        assert.equal((await listarTransformacion('PROCESADO',q,t)).items.length,10);assert.equal((await filasTransformacion('PROCESADO',q,true,t)).length,12);
        const filtered=await listarTransformacion('PROCESADO',{id_productor:pid,estado:'CONFIRMADO',modalidad:'COMPRA',limit:100},t);assert.equal(filtered.total,1);assert.equal(Number(filtered.resumen.resultados.find((r:any)=>r.producto.startsWith('ARROZ ENTERO'))!.cantidad),30.125);
        assert.equal((await listarTransformacion('ENVASADO',{id_productor:pid,presentacion:e.presentacion,estado:'CONFIRMADO',id_producto:dest},t)).total,2);
        const dir=fs.mkdtempSync(path.join(os.tmpdir(),'codex-transformaciones-'));
        for(const type of ['PROCESADO','ENVASADO'] as const){const hoja=await hojaTransformacion(type,{id_productor:pid},'pdf',t),pdf=await bufferReportePdf([hoja]);const file=path.join(dir,type.toLowerCase()+'.pdf');fs.writeFileSync(file,pdf.buffer);files.push(file);assert(pdf.paginas>0);
            const excel=await hojaTransformacion(type,{id_productor:pid},'xlsx',t);assert(excel.filas.length>0);assert.equal(excel.mostrarTotalesAutomaticos,false);
            for(const grupo of ['lotes','productos','empaques','productores','ubicaciones'])assert((await opcionesTransformacion(type,{grupo},t)).length<=50);
        }
        // Venta/reserva del resultado impide reversión; después se revierte desde el final.
        await ReservaProducto.create({id_producto:dest,cantidad:7},{transaction:t});await rejected(()=>anularTransformacion('ENVASADO',e.id,{version:e.version,motivo:'Resultado reservado, debe bloquear'},uid,t));
        await ReservaProducto.update({cantidad:0},{where:{id_producto:dest},transaction:t});
        te=await anularTransformacion('ENVASADO',te.id,{version:te.version,motivo:'Reversión del servicio de prueba'},uid,t);tp=await anularTransformacion('PROCESADO',tp.id,{version:tp.version,motivo:'Reversión del procesado de tercero'},uid,t);
        e=await anularTransformacion('ENVASADO',e.id,{version:e.version,motivo:'Reversión del envasado propio'},uid,t);assert.equal(await stock(bag),200);assert.equal(await stock(dest),3);assert.equal(await stock(pulido),40.125);
        await anularTransformacion('ENVASADO',e.id,{version:0,motivo:'Reintento de anulación de prueba'},uid,t);assert.equal(await stock(bag),200);
        p=await anularTransformacion('PROCESADO',p.id,{version:p.version,motivo:'Reversión del pilado propio'},uid,t);assert.equal(await stock(chala),200.125);assert.equal(await stock(pulido),10);assert.equal(await stock(granillo),0);assert.equal(await stock(afrecho),0);assert.equal(await disponible(own),100.125);assert.equal(await disponible(third),100.125);
        assert.deepEqual(await finance(),financeBefore);
        const audit=await obtenerTransformacion('PROCESADO',p.id,t);assert(audit.historial.some((a:any)=>a.evento==='ANULAR'));
        console.log(JSON.stringify({validaciones:'OK',rollbackPorFalloDeEmpaques:'OK',produccionParcial:'OK',custodiaTerceros:'OK',reservasYReversion:'OK',filtrosPaginacionYExportacion:'OK',archivos:files}));
    }finally{await t.rollback();}
    assert.equal(await huella(),antes,'No deben persistir registros ficticios.');console.log(JSON.stringify({registrosDePruebaPersistidos:0,huellas:'todas las tablas sin cambios'}));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>sequelize.close());
