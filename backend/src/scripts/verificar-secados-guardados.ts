import '../load-env';
import assert from 'assert/strict';
import {randomUUID, createHash} from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {QueryTypes, Transaction} from 'sequelize';
import {Proveedor, Productos, User, sequelize, Compra, CompraDetalle, MovimientoInventario, ReservaProducto} from '../models';
import {crearDescarguio, confirmarDescarguio, anularDescarguio, leerDesc} from '../servicios/descarguios.servicio';
import {guardarEtapa, confirmarEtapa, anularEtapa, obtenerEtapa} from '../servicios/produccion-etapas.servicio';
import {filasEtapa, listarEtapa, opcionesEtapa, hojaEtapa} from '../servicios/produccion-etapas-consulta.servicio';
import {validarEtapa} from '../dtos/produccion-etapa.dto';
import {ErrorDescarguio} from '../dtos/descarguio.dto';
import {bufferReportePdf} from '../utils/exportar';

async function hash() {
    const h=createHash('sha256');
    for(const table of (await sequelize.getQueryInterface().showAllTables()).map(String).sort()) {
        const rows=await sequelize.query('SELECT * FROM `'+table.replace(/`/g,'``')+'`',{type:QueryTypes.SELECT});
        h.update(table).update(rows.map(r=>JSON.stringify(r)).sort().join('\n'));
    } return h.digest('hex');
}
async function main(){
    if(process.env.NODE_ENV!=='development')throw new Error('Solo admite una base de desarrollo.');
    await sequelize.authenticate(); const before=await hash();
    const t=await sequelize.transaction({isolationLevel:Transaction.ISOLATION_LEVELS.READ_COMMITTED});
    const files:string[]=[];
    try {
        const user=await User.findOne({where:{activo:true,eliminado:false},transaction:t});assert(user);const uid=Number(user.get('id')),mark=randomUUID().slice(0,8);
        const productor=await Proveedor.create({nombre:`PRODUCTOR DE PRUEBA ${mark} NOMBRE EXTENSO PARA REVISAR LA ALINEACION Y CONTINUIDAD DEL TEXTO EN LOS REPORTES DE SECADOS Y GUARDADOS`,activo:true},{transaction:t}),pid=Number(productor.get('id'));
        const producto=await Productos.create({nombre:`CHALA DE PRUEBA ${mark}`,unidad_medida:'Fanega',stock:100.125},{transaction:t}),prid=Number(producto.get('id'));
        const fecha='2026-11-05T12:00:00.000Z';
        const finanzas=async()=>{const counts=[];for(const table of ['compras','ventas','movimientos_caja','pagos_proveedor','movimientos_inventario']){const [r]=await leerDesc(`SELECT COUNT(*) n FROM ${table}`,{},t);counts.push(Number(r.n));}return counts;};
        const rejected=(fn:()=>Promise<unknown>)=>assert.rejects(fn,(e:unknown)=>e instanceof ErrorDescarguio);
        const recepcion=async(cantidad:number,extra:Record<string,any>={})=>{const d=await crearDescarguio({fecha,modalidad:'SERVICIO',id_productor:pid,id_producto:prid,boleta:'PRUEBA-'+mark,variedad:'MAC-18 PRUEBA',cantidad,unidad:'Fanega',humedad_entrada:18.5,clave_creacion:randomUUID(),...extra},uid,t);return confirmarDescarguio(d.id,{version:d.version,clave_confirmacion:randomUUID()},uid,t);};
        const d1=await recepcion(100.125),d2=await recepcion(20.25);
        const balances=async()=>{const [r]=await leerDesc("SELECT SUM(cantidad_disponible) n FROM produccion_lotes WHERE id_producto = :id AND modalidad='SERVICIO' AND estado='ACTIVO'",{id:prid},t);return Number(r.n);};
        const dry={fecha:'2026-11-05T13:00:00.000Z',origenes:[{id_lote:d1.id_lote,cantidad:30.125},{id_lote:d2.id_lote,cantidad:10.25}],secadora:'SECADORA MANUAL '+mark,operador:'OPERADOR DE PRUEBA',inicio:'2026-11-05T13:00:00.000Z',fin:'2026-11-06T01:00:00.000Z',humedad_entrada:18.5,humedad_salida:11.3,peso_salida:22.5,unidad_peso_salida:'Kilo',merma_medida:0,unidad_merma:'Kilo',justificacion_merma:'Medición de prueba, cero observado',destino_nombre:'SILO DE PRUEBA '+mark};
        for(const bad of [{humedad_salida:101},{origenes:[{id_lote:d1.id_lote,cantidad:-1}]},{fin:'2026-11-05T01:00:00Z'},{peso_salida:1,unidad_peso_salida:null},{merma_medida:2,justificacion_merma:null}])assert.throws(()=>validarEtapa('SECADO',{...dry,...bad},true));
        let blank=await guardarEtapa('SECADO',null,{fecha,origenes:[{id_lote:d1.id_lote,cantidad:null}],clave_creacion:randomUUID()},uid,t);
        assert.equal(blank.origenes[0].cantidad,null);
        await rejected(()=>anularDescarguio(d1.id,{version:d1.version,motivo:'Bloqueo por borrador dependiente'},uid,t));
        await anularEtapa('SECADO',blank.id,{version:blank.version,motivo:'Se reemplaza el borrador de prueba'},uid,t);
        const financialBefore=await finanzas();
        const key=randomUUID();let s=await guardarEtapa('SECADO',null,{...dry,clave_creacion:key},uid,t);
        assert.equal((await guardarEtapa('SECADO',null,{...dry,clave_creacion:key},uid,t)).id,s.id);
        assert.equal(await balances(),120.375);assert.equal(s.peso_salida,'22.500');
        await rejected(()=>guardarEtapa('SECADO',s.id,{...dry,version:999},uid,t));
        const confirmKey=randomUUID();s=await confirmarEtapa('SECADO',s.id,{version:s.version,clave_confirmacion:confirmKey},uid,t);
        assert.equal((await confirmarEtapa('SECADO',s.id,{version:0,clave_confirmacion:confirmKey},uid,t)).id,s.id);
        assert.equal(s.origenes.length,2);assert.equal(await balances(),120.375);
        let [src]=await leerDesc('SELECT cantidad_disponible FROM produccion_lotes WHERE id = :id',{id:d1.id_lote},t);assert.equal(Number(src.cantidad_disponible),70);
        const out=Number(s.origenes[0].id_lote_resultado);
        const [lot]=await leerDesc('SELECT * FROM produccion_lotes WHERE id = :id',{id:out},t);assert.equal(lot.modalidad,'SERVICIO');assert.equal(Number(lot.id_propietario),pid);assert.equal(lot.etapa,'SECADO');assert.equal(Number(lot.cantidad_disponible),30.125);
        let excessive=await guardarEtapa('SECADO',null,{...dry,origenes:[{id_lote:d1.id_lote,cantidad:70.001}],clave_creacion:randomUUID()},uid,t);
        await rejected(()=>confirmarEtapa('SECADO',excessive.id,{version:excessive.version,clave_confirmacion:randomUUID()},uid,t));
        await anularEtapa('SECADO',excessive.id,{version:excessive.version,motivo:'Cantidad de prueba excesiva'},uid,t);
        const storage={fecha:'2026-11-06T02:00:00Z',origenes:[{id_lote:out,cantidad:12.005}],destino_nombre:'ALMACEN PRUEBA '+mark,ubicacion_detalle:'N-1 / 5A / 3',responsable:'RESPONSABLE PRUEBA',condicion:'Seco'};
        let g=await guardarEtapa('GUARDADO',null,{...storage,clave_creacion:randomUUID()},uid,t);
        await rejected(()=>anularEtapa('SECADO',s.id,{version:s.version,motivo:'No debe anular con guardado relacionado'},uid,t));
        g=await confirmarEtapa('GUARDADO',g.id,{version:g.version,clave_confirmacion:randomUUID()},uid,t);
        assert.equal(await balances(),120.375);
        const [residual]=await leerDesc('SELECT cantidad_disponible FROM produccion_lotes WHERE id = :id',{id:out},t);assert.equal(Number(residual.cantidad_disponible),18.12);
        const [stored]=await leerDesc('SELECT * FROM produccion_lotes WHERE id = :id',{id:g.origenes[0].id_lote_resultado},t);assert.equal(stored.etapa,'GUARDADO');assert.equal(Number(stored.cantidad_disponible),12.005);assert.equal(Number(stored.id_propietario),pid);
        assert.deepEqual(await finanzas(),financialBefore);await producto.reload({transaction:t});assert.equal(Number(producto.get('stock')),100.125);
        // La propiedad se valida contra el lote, nunca contra lo enviado por el cliente.
        const other=await Proveedor.create({nombre:'OTRO PRODUCTOR '+mark,activo:true},{transaction:t});
        const d3=await recepcion(1,{id_productor:Number(other.get('id'))});
        await rejected(()=>guardarEtapa('SECADO',null,{...dry,origenes:[{id_lote:d1.id_lote,cantidad:1},{id_lote:d3.id_lote,cantidad:1}],clave_creacion:randomUUID()},uid,t));
        const filtro={id_productor:pid,fecha_desde:'2026-11-01',fecha_hasta:'2026-11-30',estado:'CONFIRMADO',variedad:'MAC-18 PRUEBA',orden:'cantidad',direccion:1,limit:10};
        const result=await listarEtapa('SECADO',{...filtro,secadora:dry.secadora},t);assert.equal(result.total,1);assert.equal(Number(result.resumen.cantidades[0].cantidad),40.375);
        assert.equal((await listarEtapa('GUARDADO',{...filtro,ubicacion:storage.destino_nombre},t)).total,1);
        for(let i=0;i<11;i++)await guardarEtapa('GUARDADO',null,{...storage,clave_creacion:randomUUID()},uid,t);
        assert.equal((await listarEtapa('GUARDADO',{id_productor:pid,limit:10},t)).items.length,10);
        assert.equal((await filasEtapa('GUARDADO',{id_productor:pid,limit:10},true,t)).length,12);
        assert.equal((await listarEtapa('GUARDADO',{id_productor:pid,limit:100},t)).total,12);
        const dir=fs.mkdtempSync(path.join(os.tmpdir(),'codex-secados-guardados-'));
        for(const type of ['SECADO','GUARDADO'] as const){
            const sheet=await hojaEtapa(type,{id_productor:pid,estado:'CONFIRMADO'},'pdf',t);const pdf=await bufferReportePdf([sheet]);
            const file=path.join(dir,type.toLowerCase()+'.pdf');fs.writeFileSync(file,pdf.buffer);files.push(file);assert(pdf.paginas>0);
            const excel=await hojaEtapa(type,{id_productor:pid},'xlsx',t);assert.equal(excel.formatosNumericos?.Cantidad,'#,##0.###');
            for(const group of ['lotes','ubicaciones','productores',...(type==='SECADO'?['secadoras']:[])])assert((await opcionesEtapa(type,{grupo:group},t)).length<=50);
        }
        // Reversión en cadena conservando historia y permitiendo deshacer desde el final.
        const drafts=await filasEtapa('GUARDADO',{id_productor:pid,estado:'BORRADOR'},true,t);
        for(const draft of drafts)await anularEtapa('GUARDADO',draft.id,{version:draft.version,motivo:'Fin de prueba del borrador'},uid,t);
        g=await anularEtapa('GUARDADO',g.id,{version:g.version,motivo:'Prueba de reversión de guardado'},uid,t);
        assert.equal((await anularEtapa('GUARDADO',g.id,{version:0,motivo:'Reintento de anulación de prueba'},uid,t)).estado,'ANULADO');
        s=await anularEtapa('SECADO',s.id,{version:s.version,motivo:'Prueba de reversión de secado'},uid,t);
        [src]=await leerDesc('SELECT cantidad_disponible FROM produccion_lotes WHERE id = :id',{id:d1.id_lote},t);assert.equal(Number(src.cantidad_disponible),100.125);
        await anularDescarguio(d1.id,{version:d1.version,motivo:'Reversión final del descarguío de prueba'},uid,t);
        // Existencias propias: ambas etapas conservan la única entrada comercial de compra.
        const provider=await Proveedor.create({nombre:'PROVEEDOR PRUEBA '+mark,activo:true},{transaction:t});
        const purchase=await Compra.create({id_proveedor:provider.get('id'),id_productor:pid,fecha,total:0,saldo_pendiente:0,estado:'PENDIENTE',tipo_compra:'CHALA',anticipada:true,estado_recepcion:'COMPLETA',id_usuario:uid},{transaction:t});
        const detail=await CompraDetalle.create({id_compra:purchase.get('id'),id_producto:prid,descripcion:'Prueba',unidad:'Fanega',cantidad:100.125,cantidad_recibida:100.125,precio_unitario:0,subtotal:0},{transaction:t});
        await MovimientoInventario.create({id_producto:prid,tipo:'ENTRADA',cantidad:100.125,stock_resultante:100.125,origen:'COMPRA',origen_id:purchase.get('id'),fecha,id_usuario:uid},{transaction:t});
        const own=await recepcion(100.125,{modalidad:'COMPRA',id_compra_detalle:Number(detail.get('id'))});
        let ownS=await guardarEtapa('SECADO',null,{...dry,origenes:[{id_lote:own.id_lote,cantidad:100.125}],clave_creacion:randomUUID()},uid,t);
        await ReservaProducto.create({id_producto:prid,cantidad:1},{transaction:t});
        await rejected(()=>confirmarEtapa('SECADO',ownS.id,{version:ownS.version,clave_confirmacion:randomUUID()},uid,t));
        await ReservaProducto.update({cantidad:0},{where:{id_producto:prid},transaction:t});
        const commercialBefore=await finanzas();
        ownS=await confirmarEtapa('SECADO',ownS.id,{version:ownS.version,clave_confirmacion:randomUUID()},uid,t);
        let ownG=await guardarEtapa('GUARDADO',null,{...storage,origenes:[{id_lote:ownS.origenes[0].id_lote_resultado,cantidad:100.125}],clave_creacion:randomUUID()},uid,t);
        ownG=await confirmarEtapa('GUARDADO',ownG.id,{version:ownG.version,clave_confirmacion:randomUUID()},uid,t);
        assert.equal(ownG.modalidad,'COMPRA');assert.equal(ownG.id_propietario,null);assert.deepEqual(await finanzas(),commercialBefore);
        await producto.reload({transaction:t});assert.equal(Number(producto.get('stock')),100.125);
        console.log(JSON.stringify({parcialesYMultiplesLotes:'OK',propiedadYUnidades:'OK',stockReservasYDobleDescuento:'OK',idempotenciaYVersion:'OK',anulacionEnCadena:'OK',filtrosPaginacionYExportacion:'OK',archivos:files}));
    } finally {await t.rollback();}
    assert.equal(await hash(),before,'No deben persistir registros de prueba.');
    console.log(JSON.stringify({registrosDePruebaPersistidos:0,huellasDeTodasLasTablas:'sin cambios'}));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>sequelize.close());
