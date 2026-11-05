import { createHash } from 'crypto';
import { QueryTypes, Transaction } from 'sequelize';
import sequelize from '../db/connection';
import { Productos, ReservaProducto, MovimientoInventario, CategoriaProducto } from '../models';
import { esProductoEmpaque } from '../utils/empaque';
import { normalizarUnidadMedida, esUnidadMedidaValida } from '../utils/unidad-medida';
import { ErrorDescarguio, claveSolicitud, versionDescarguio } from '../dtos/descarguio.dto';
import { FilaEtapa as Fila } from '../dtos/produccion-etapa.dto';
import { Transformacion, validarTransformacion } from '../dtos/produccion-transformacion.dto';
import { leerDesc } from './descarguios.servicio';

const tabla=(tipo:Transformacion)=>tipo==='PROCESADO'?'produccion_procesados':'produccion_envasados';
const mil=(v:any)=>Math.round(Number(v||0)*1000);
const tx=<T>(work:(t:Transaction)=>Promise<T>,external?:Transaction)=>sequelize.transaction({transaction:external,isolationLevel:Transaction.ISOLATION_LEVELS.READ_COMMITTED},work);
async function sql(query:string,replacements:Fila,t:Transaction){return sequelize.query(query,{replacements,transaction:t});}
async function insert(table:string,data:Fila,t:Transaction){const keys=Object.keys(data);const [id]=await sequelize.query(`INSERT INTO ${table} (${keys.map(k=>'`'+k+'`').join(',')}) VALUES (${keys.map(k=>':'+k).join(',')})`,{replacements:data,transaction:t,type:QueryTypes.INSERT});return Number(id);}
const entero=(id:unknown)=>{if(!Number.isSafeInteger(Number(id))||Number(id)<=0)throw new ErrorDescarguio('Identificador inválido.');return Number(id);};
const checkVersion=(o:Fila,raw:Fila)=>{if(Number(o.version)!==versionDescarguio(raw.version))throw new ErrorDescarguio('El documento cambió. Vuelva a abrirlo antes de guardar.',409);};
async function audit(id:number,evento:string,antes:any,despues:any,usuario:number,t:Transaction,motivo:string|null=null){await insert('produccion_auditoria',{id_operacion:id,evento,antes:antes==null?null:JSON.stringify(antes),despues:despues==null?null:JSON.stringify(despues),motivo,fecha:new Date(),id_usuario:usuario},t);}
async function lock(tipo:Transformacion,id:unknown,t:Transaction){const [o]=await leerDesc('SELECT * FROM produccion_operaciones WHERE id = :id AND tipo = :tipo FOR UPDATE',{id:entero(id),tipo},t);if(!o)throw new ErrorDescarguio('No se encontró el documento.',404);return o;}

export function resumenTransformacion(tipo:Transformacion,d:Fila,origins:Fila[]):Fila {
    if(tipo==='ENVASADO')return {peso_total_kg:d.numero_bolsas!=null&&d.contenido_bolsa_kg!=null?Math.round(Number(d.numero_bolsas)*Number(d.contenido_bolsa_kg)*1000)/1000:null};
    const input=origins.length&&origins.every(o=>o.unidad==='Kilo')?origins.reduce((sum,o)=>sum+mil(o.cantidad),0)/1000:d.peso_entrada_kg==null?null:Number(d.peso_entrada_kg);
    const results=d.resultados||[];
    const known=results.length&&results.every((r:Fila)=>r.unidad==='Kilo'&&r.cantidad!=null||r.peso_real_kg!=null);
    const output=known?results.reduce((sum:number,r:Fila)=>sum+mil(r.unidad==='Kilo'?r.cantidad:r.peso_real_kg),0)/1000:null;
    const merma=d.merma_medida!=null&&d.unidad_merma==='Kilo'?Number(d.merma_medida):null;
    return {peso_entrada_kg:input,peso_salida_kg:output,rendimiento:input!=null&&input>0&&output!=null?output/input*100:null,diferencia_kg:input!=null&&output!=null?Math.round((input-output)*1000)/1000:null,merma_kg:merma};
}
export async function obtenerTransformacion(tipo:Transformacion,id:unknown,t?:Transaction):Promise<Fila>{
    const [o]=await leerDesc(`SELECT o.*,d.*,p.nombre productor,u.nombre ubicacion,${tipo==='ENVASADO'?'pd.nombre producto_destino,pd.unidad_medida destino_unidad,pe.nombre empaque,':'NULL maquina_reservada,'} 1 completo
        FROM produccion_operaciones o JOIN ${tabla(tipo)} d ON d.id_operacion=o.id LEFT JOIN productores p ON p.id=o.id_productor
        LEFT JOIN produccion_ubicaciones u ON u.id=d.id_ubicacion ${tipo==='ENVASADO'?'LEFT JOIN productos pd ON pd.id=d.id_producto_destino LEFT JOIN productos pe ON pe.id=d.id_producto_empaque':''}
        WHERE o.id = :id AND o.tipo = :tipo`,{id:entero(id),tipo},t);
    if(!o)throw new ErrorDescarguio('No se encontró el documento.',404);
    const origenes=await leerDesc(`SELECT r.*,l.codigo,l.unidad,l.variedad,l.modalidad,l.id_propietario,l.id_productor,l.id_producto,l.cantidad_disponible,p.nombre productor,pr.nombre producto,dp.clasificacion,oo.codigo origen_codigo,oo.fecha origen_fecha
        FROM produccion_etapa_origenes r JOIN produccion_lotes l ON l.id=r.id_lote JOIN produccion_operaciones oo ON oo.id=l.id_operacion_origen
        LEFT JOIN productores p ON p.id=l.id_productor LEFT JOIN productos pr ON pr.id=l.id_producto LEFT JOIN produccion_procesado_detalles dp ON dp.id_lote_resultado=l.id WHERE r.id_operacion = :id ORDER BY r.id`,{id:o.id},t);
    const resultados=tipo==='PROCESADO'?await leerDesc(`SELECT d.*,p.nombre producto,l.codigo lote_codigo,l.cantidad_disponible FROM produccion_procesado_detalles d LEFT JOIN productos p ON p.id=d.id_producto
        LEFT JOIN produccion_lotes l ON l.id=d.id_lote_resultado WHERE d.id_operacion = :id ORDER BY d.id`,{id:o.id},t):[];
    const lotes=await leerDesc('SELECT id,codigo,cantidad_disponible,unidad,id_producto FROM produccion_lotes WHERE id_operacion_origen = :id ORDER BY id',{id:o.id},t);
    const historial=await leerDesc(`SELECT a.evento,a.fecha,a.motivo,COALESCE(NULLIF(u.nombre,''),u.username) usuario FROM produccion_auditoria a LEFT JOIN user u ON u.id=a.id_usuario WHERE a.id_operacion = :id ORDER BY a.id`,{id:o.id},t);
    return {...o,origenes,resultados,lotes,historial,resumen:resumenTransformacion(tipo,{...o,resultados},origenes)};
}
async function fuentes(tipo:Transformacion,d:Fila,t:Transaction,confirmar=false):Promise<Fila[]>{
    const ids=d.origenes.map((r:Fila)=>r.id_lote).sort((a:number,b:number)=>a-b);if(!ids.length)return [];
    const refs=await leerDesc('SELECT DISTINCT id_operacion_origen id FROM produccion_lotes WHERE id IN (:ids) ORDER BY id_operacion_origen',{ids},t);
    for(const r of refs)await leerDesc('SELECT id FROM produccion_operaciones WHERE id = :id FOR UPDATE',{id:r.id},t);
    const lots=await leerDesc(`SELECT l.*,o.estado estado_origen,o.fecha fecha_origen,o.id_campana FROM produccion_lotes l JOIN produccion_operaciones o ON o.id=l.id_operacion_origen WHERE l.id IN (:ids) ORDER BY l.id FOR UPDATE`,{ids},t);
    if(lots.length!==ids.length)throw new ErrorDescarguio('Un lote de origen no existe.',409);
    for(const l of lots){
        if(l.etapa!==(tipo==='PROCESADO'?'GUARDADO':'PROCESADO')||l.estado_origen!=='CONFIRMADO'||l.estado==='ANULADO'||confirmar&&(l.estado!=='ACTIVO'||mil(l.cantidad_disponible)<=0))throw new ErrorDescarguio('El lote '+l.codigo+' no está disponible en la etapa de origen.',409);
        if(['modalidad','id_propietario','id_productor','id_producto','unidad','variedad'].some(k=>String(l[k]??'')!==String(lots[0][k]??'')))throw new ErrorDescarguio('No mezcle propietarios, productos, variedades o unidades diferentes.',400,{origenes:'Use operaciones separadas.'});
        if(d.fecha<l.fecha_origen)throw new ErrorDescarguio('La fecha no puede ser anterior al origen.',400,{fecha:'Revise la fecha del lote.'});
        const r=d.origenes.find((r:Fila)=>r.id_lote===Number(l.id));
        if(confirmar&&mil(r.cantidad)>mil(l.cantidad_disponible))throw new ErrorDescarguio('La cantidad supera el disponible de '+l.codigo+'.',409,{origenes:'Actualice y ajuste la cantidad disponible.'});
    }return lots;
}
async function productos(ids:number[],t:Transaction){
    const map=new Map<number,any>();
    for(const id of [...new Set(ids.filter(Boolean))].sort((a,b)=>a-b)){
        const p=await Productos.findByPk(id,{transaction:t,lock:t.LOCK.UPDATE});if(!p||p.get('eliminado'))throw new ErrorDescarguio('Seleccione productos vigentes.',400);
        if(!esUnidadMedidaValida(p.get('unidad_medida')))throw new ErrorDescarguio('El producto '+p.get('nombre')+' tiene una unidad no admitida. Revise su configuración.',400);
        const c=p.get('id_categoria')?await CategoriaProducto.findByPk(p.get('id_categoria') as number,{transaction:t}):null;
        const nombre=String(p.get('nombre')),categoria=c?{nombre:c.get('nombre')}:null;
        const empaque=esProductoEmpaque({categoria})||(!/arroz|granillo|afrecho/i.test(nombre)&&esProductoEmpaque({nombre}));
        map.set(id,{model:p,unidad:normalizarUnidadMedida(p.get('unidad_medida')),empaque});
    }return map;
}
async function validarProductos(tipo:Transformacion,d:Fila,lots:Fila[],t:Transaction,confirmar=false){
    const ids=[...lots.map(l=>Number(l.id_producto)),...(tipo==='PROCESADO'?d.resultados.map((r:Fila)=>r.id_producto):[d.id_producto_empaque,d.id_producto_destino])];
    const ps=await productos(ids,t);
    if(tipo==='PROCESADO')for(const [i,r] of d.resultados.entries())if(r.id_producto){
        const p=ps.get(r.id_producto)!;
        if(p.empaque)throw new ErrorDescarguio('Un producto obtenido no puede ser una bolsa vacía.',400,{resultados:'Seleccione productos de arroz o subproductos.'});
        if(lots.some(l=>Number(l.id_producto)===r.id_producto))throw new ErrorDescarguio('El producto obtenido debe distinguirse del arroz en chala consumido.',400,{resultados:'Seleccione el producto resultante, no la materia prima.'});
        if(r.unidad&&normalizarUnidadMedida(r.unidad)!==p.unidad)throw new ErrorDescarguio('La unidad del resultado debe coincidir con el producto.',400,{['resultados.'+i+'.unidad']:'Use '+p.unidad+'.'});
        r.unidad=p.unidad;
    }
    if(tipo==='ENVASADO'){
        const bag=ps.get(d.id_producto_empaque),dest=ps.get(d.id_producto_destino);
        if(bag&&(!bag.empaque||bag.unidad!=='Unidad'))throw new ErrorDescarguio('Seleccione un empaque del catálogo medido en unidades.',400,{id_producto_empaque:'La bolsa debe manejarse por Unidad.'});
        if(dest&&(dest.empaque||lots.some(l=>Number(l.id_producto)===d.id_producto_destino)))throw new ErrorDescarguio('Seleccione un producto envasado distinto del producto a granel y de la bolsa vacía.',400,{id_producto_destino:'Seleccione el producto de arroz terminado.'});
        d.unidad_destino=dest?.unidad||null;
        if(confirmar){
            const source=lots[0],sourceFactor=source.unidad==='Kilo'?1:d.equivalencia_kg_origen;
            const destFactor=dest!.unidad==='Kilo'?1:d.equivalencia_kg_destino;
            if(!sourceFactor||dest!.unidad!=='Unidad'&&!destFactor)throw new ErrorDescarguio('Falta una equivalencia explícita en kg por unidad. No hay conversión automática.',400,{equivalencia_kg_origen:!sourceFactor?'Indique kg por '+source.unidad+'.':'',equivalencia_kg_destino:dest!.unidad!=='Unidad'&&!destFactor?'Indique kg por '+dest!.unidad+'.':''});
            if((source.unidad!=='Kilo'||!['Kilo','Unidad'].includes(dest!.unidad))&&!d.origen_equivalencia)throw new ErrorDescarguio('Indique el origen de las equivalencias utilizadas.',400,{origen_equivalencia:'Describa la medición o referencia autorizada.'});
            const total=Math.round(d.numero_bolsas*d.contenido_bolsa_kg*1000)/1000;
            if(total<=0||total>999999999.999)throw new ErrorDescarguio('El peso total envasado excede la precisión admitida.',400);
            const consumed=d.origenes[0].cantidad;
            if(Math.abs(consumed*sourceFactor-total)>0.00100001)throw new ErrorDescarguio('La cantidad consumida no coincide con el contenido total y su equivalencia.',400,{origenes:'Cantidad × kg por unidad debe ser igual a envases × contenido en kg.'});
            d.peso_total_kg=total;d.equivalencia_kg_origen=sourceFactor;
            d.cantidad_destino=dest!.unidad==='Unidad'?d.numero_bolsas:Math.round(total/destFactor*1000)/1000;
            if(d.cantidad_destino<=0||d.cantidad_destino>999999999.999||dest!.unidad!=='Unidad'&&Math.abs(d.cantidad_destino*destFactor-total)>0.00100001)throw new ErrorDescarguio('La presentación no puede representarse exactamente en la unidad del producto destino (3 decimales).',400,{equivalencia_kg_destino:'Revise la equivalencia o use un producto por Unidad.'});
            d.equivalencia_kg_destino=dest!.unidad==='Unidad'?null:destFactor;
        }
    }
    if(confirmar&&lots[0]?.modalidad==='COMPRA'){
        const id=Number(lots[0].id_producto),p=ps.get(id)!;const r=await ReservaProducto.findByPk(id,{transaction:t,lock:t.LOCK.UPDATE});
        const [active]=await leerDesc("SELECT COALESCE(SUM(cantidad_disponible),0) n FROM produccion_lotes WHERE id_producto = :id AND modalidad='COMPRA' AND estado='ACTIVO'",{id},t);
        if(p.unidad!==lots[0].unidad||mil(active.n)>mil(p.model.get('stock'))-mil(r?.get('cantidad')))throw new ErrorDescarguio('El stock propio disponible no respalda los lotes activos. Revise existencias y reservas.',409);
    }
    if(tipo==='PROCESADO'&&confirmar){
        const origins=d.origenes.map((r:Fila)=>({...r,unidad:lots[0].unidad})),summary=resumenTransformacion(tipo,d,origins);
        if(lots[0].unidad==='Kilo'&&d.peso_entrada_kg!=null&&mil(d.peso_entrada_kg)!==mil(summary.peso_entrada_kg))throw new ErrorDescarguio('El peso de entrada no coincide con los kilos consumidos.',400,{peso_entrada_kg:'Revise la medición.'});
        for(const r of d.resultados)if(r.unidad==='Kilo'&&r.peso_real_kg!=null&&mil(r.peso_real_kg)!==mil(r.cantidad))throw new ErrorDescarguio('El peso del resultado no coincide con su cantidad en kilos.',400,{resultados:'Revise cantidades y pesos.'});
        if(summary.peso_entrada_kg!=null&&summary.peso_salida_kg!=null&&mil(summary.peso_salida_kg)+mil(summary.merma_kg)>mil(summary.peso_entrada_kg))throw new ErrorDescarguio('Los pesos medidos de productos y merma superan el peso de entrada.',400,{resultados:'Revise el balance de pesos medidos.'});
        d.peso_salida_kg=summary.peso_salida_kg;
    }
    if(d.id_ubicacion){const [u]=await leerDesc('SELECT id FROM produccion_ubicaciones WHERE id = :id AND activo=1',{id:d.id_ubicacion},t);if(!u)throw new ErrorDescarguio('La ubicación no está activa.',400);}
    return ps;
}
function fields(tipo:Transformacion){return ['id_ubicacion','destino_nombre','ubicacion_detalle',...(tipo==='PROCESADO'?['maquina','peso_entrada_kg','peso_salida_kg','merma_medida','unidad_merma','justificacion_merma']:['id_producto_empaque','id_producto_destino','presentacion','numero_bolsas','contenido_bolsa_kg','peso_total_kg','equivalencia_kg_origen','equivalencia_kg_destino','origen_equivalencia','cantidad_destino','unidad_destino'])];}
async function detalle(tipo:Transformacion,id:number,d:Fila,t:Transaction,nuevo=false){
    const values=Object.fromEntries(fields(tipo).map(k=>[k,d[k]??null]));
    if(nuevo)await insert(tabla(tipo),{id_operacion:id,...values},t);else await sql(`UPDATE ${tabla(tipo)} SET ${Object.keys(values).map(k=>k+' = :'+k).join(',')} WHERE id_operacion = :id`,{...values,id},t);
    await sql('DELETE FROM produccion_etapa_origenes WHERE id_operacion = :id',{id},t);await sql("DELETE FROM produccion_operacion_lotes WHERE id_operacion = :id AND rol='ENTRADA'",{id},t);
    for(const r of d.origenes){await insert('produccion_etapa_origenes',{id_operacion:id,id_lote:r.id_lote,cantidad:r.cantidad},t);if(r.cantidad!=null){const [l]=await leerDesc('SELECT unidad FROM produccion_lotes WHERE id = :id',{id:r.id_lote},t);await insert('produccion_operacion_lotes',{id_operacion:id,id_lote:r.id_lote,rol:'ENTRADA',cantidad:r.cantidad,unidad:l.unidad},t);}}
    if(tipo==='PROCESADO'){await sql('DELETE FROM produccion_procesado_detalles WHERE id_operacion = :id',{id},t);for(const r of d.resultados)await insert('produccion_procesado_detalles',{id_operacion:id,...r},t);}
}
export async function guardarTransformacion(tipo:Transformacion,id:unknown|null,raw:Fila,usuario:number,externa?:Transaction){
    const d=validarTransformacion(tipo,raw),key=id==null?claveSolicitud(raw.clave_creacion):null,hash=createHash('sha256').update(JSON.stringify({tipo,...d})).digest('hex');
    return tx(async t=>{
        let o:Fila|null=null;const gestion=Number(new Intl.DateTimeFormat('en',{timeZone:'America/La_Paz',year:'numeric'}).format(d.fecha));
        if(id==null){await sql('INSERT INTO produccion_secuencias (tipo,gestion,ultimo) VALUES (:tipo,:gestion,0) ON DUPLICATE KEY UPDATE ultimo=ultimo',{tipo,gestion},t);await leerDesc('SELECT ultimo FROM produccion_secuencias WHERE tipo = :tipo AND gestion = :gestion FOR UPDATE',{tipo,gestion},t);
            const [exists]=await leerDesc('SELECT id,hash_creacion FROM produccion_operaciones WHERE clave_creacion = :key',{key},t);if(exists){if(exists.hash_creacion!==hash)throw new ErrorDescarguio('La solicitud ya fue guardada con otros datos.',409);return obtenerTransformacion(tipo,exists.id,t);}
        }else{o=await lock(tipo,id,t);checkVersion(o,raw);if(o.estado!=='BORRADOR')throw new ErrorDescarguio('Solo se editan borradores.',409);}
        const lots=await fuentes(tipo,d,t);await validarProductos(tipo,d,lots,t);
        const header={fecha:d.fecha,modalidad:lots[0]?.modalidad||'SERVICIO',id_propietario:lots[0]?.id_propietario??null,id_productor:lots[0]?.id_productor??null,id_campana:lots[0]?.id_campana??null,responsable:d.responsable,observacion:d.observacion};let opId:number;
        if(!o){const [seq]=await leerDesc('SELECT ultimo FROM produccion_secuencias WHERE tipo = :tipo AND gestion = :gestion',{tipo,gestion},t),n=Number(seq.ultimo)+1;await sql('UPDATE produccion_secuencias SET ultimo = :n WHERE tipo = :tipo AND gestion = :gestion',{n,tipo,gestion},t);
            opId=await insert('produccion_operaciones',{...header,codigo:`${tipo==='PROCESADO'?'P':'E'}-${gestion}-${String(n).padStart(4,'0')}`,tipo,estado:'BORRADOR',id_usuario:usuario,clave_creacion:key,hash_creacion:hash,version:0,created_at:new Date(),updated_at:new Date()},t);
        }else{opId=Number(o.id);await sql(`UPDATE produccion_operaciones SET ${Object.keys(header).map(k=>k+' = :'+k).join(',')},version=version+1,updated_at=NOW() WHERE id = :id`,{...header,id:opId},t);}
        await detalle(tipo,opId,d,t,!o);await audit(opId,o?'EDITAR_BORRADOR':'CREAR_BORRADOR',o,d,usuario,t);return obtenerTransformacion(tipo,opId,t);
    },externa);
}
async function moverInventario(op:Fila,p:any,cantidad:number,tipo:'ENTRADA'|'SALIDA',usuario:number,t:Transaction,motivo:string,reverso=false){
    const model=p.model,delta=mil(cantidad)*(tipo==='ENTRADA'?1:-1),stock=mil(model.get('stock'));
    const reserve=await ReservaProducto.findByPk(model.get('id'),{transaction:t,lock:t.LOCK.UPDATE});
    if(delta<0&&-delta>stock-mil(reserve?.get('cantidad')))throw new ErrorDescarguio('Stock disponible insuficiente de '+model.get('nombre')+'. Revise reservas y empaques.',409);
    if(stock+delta<0||stock+delta>999999999999)throw new ErrorDescarguio('El saldo de inventario excede la precisión admitida.',409);
    await model.update({stock:(stock+delta)/1000},{transaction:t});
    const m=await MovimientoInventario.create({id_producto:model.get('id'),tipo,cantidad,stock_resultante:(stock+delta)/1000,origen:(reverso?'REVERSO_':'')+(op.tipo==='PROCESADO'?'PILADO_ARROZ':'ENVASADO_ARROZ'),origen_id:op.id,observacion:motivo,id_usuario:usuario,fecha:new Date()},{transaction:t});
    return Number(m.get('id'));
}
export async function confirmarTransformacion(tipo:Transformacion,id:unknown,raw:Fila,usuario:number,externa?:Transaction){
    const key=claveSolicitud(raw.clave_confirmacion);
    return tx(async t=>{
        const o=await lock(tipo,id,t);if(o.estado==='CONFIRMADO'&&o.clave_confirmacion===key)return obtenerTransformacion(tipo,o.id,t);
        if(o.estado!=='BORRADOR')throw new ErrorDescarguio('El documento ya fue confirmado o anulado.',409);checkVersion(o,raw);
        const saved=await obtenerTransformacion(tipo,o.id,t),d=validarTransformacion(tipo,saved,true),lots=await fuentes(tipo,d,t,true),ps=await validarProductos(tipo,d,lots,t,true);
        let dest=d.id_ubicacion;
        if(!dest&&d.destino_nombre){await sql("INSERT INTO produccion_ubicaciones (nombre,tipo,activo,created_at,updated_at) VALUES (:nombre,'OTRO',1,NOW(),NOW()) ON DUPLICATE KEY UPDATE nombre=nombre",{nombre:d.destino_nombre},t);const [u]=await leerDesc('SELECT id,activo FROM produccion_ubicaciones WHERE nombre = :nombre FOR UPDATE',{nombre:d.destino_nombre},t);if(!u.activo)throw new ErrorDescarguio('La ubicación está inactiva.',409);dest=u.id;}
        const ledger=async(productId:number,cantidad:number,movement:'ENTRADA'|'SALIDA')=>{const m=await moverInventario(o,ps.get(productId),cantidad,movement,usuario,t,o.codigo);await insert('produccion_inventario_vinculos',{id_operacion:o.id,id_movimiento:m},t);};
        for(const l of lots){const r=d.origenes.find((r:Fila)=>r.id_lote===Number(l.id)),after=mil(l.cantidad_disponible)-mil(r.cantidad);
            if(o.modalidad==='COMPRA')await ledger(Number(l.id_producto),Number(r.cantidad),'SALIDA');
            await sql('UPDATE produccion_lotes SET cantidad_disponible = :after,estado = :estado,version=version+1,updated_at=NOW() WHERE id = :id',{after:after/1000,estado:after?'ACTIVO':'AGOTADO',id:l.id},t);
            await insert('produccion_movimientos',{clave:`${tipo}:${o.id}:CONSUMO:${l.id}`,id_operacion:o.id,id_lote:l.id,tipo:'SALIDA',cantidad:r.cantidad,unidad:l.unidad,saldo_anterior:l.cantidad_disponible,saldo_resultante:after/1000,fecha:new Date(),id_usuario:usuario,id_ubicacion_origen:l.id_ubicacion,id_ubicacion_destino:dest??null},t);
        }
        const results=tipo==='PROCESADO'?d.resultados:[{id_producto:d.id_producto_destino,cantidad:d.cantidad_destino,unidad:d.unidad_destino,clasificacion:saved.origenes[0]?.producto}];
        if(tipo==='ENVASADO')await ledger(d.id_producto_empaque,d.numero_bolsas,'SALIDA');
        for(const [index,r] of results.entries()){
            const lotId=await insert('produccion_lotes',{codigo:`${o.codigo}-R${index+1}`,id_operacion_origen:o.id,id_producto:r.id_producto,modalidad:o.modalidad,id_propietario:o.id_propietario,id_productor:o.id_productor,variedad:lots[0].variedad,
                cantidad_inicial:r.cantidad,cantidad_disponible:r.cantidad,unidad:r.unidad,etapa:tipo,estado_fisico:tipo==='PROCESADO'?'PROCESADO':'ENVASADO',estado:'ACTIVO',id_ubicacion:dest??null,ubicacion_detalle:d.ubicacion_detalle,id_usuario:usuario,version:0,created_at:new Date(),updated_at:new Date()},t);
            await insert('produccion_operacion_lotes',{id_operacion:o.id,id_lote:lotId,rol:'SALIDA',cantidad:r.cantidad,unidad:r.unidad},t);
            await insert('produccion_movimientos',{clave:`${tipo}:${o.id}:RESULTADO:${index+1}`,id_operacion:o.id,id_lote:lotId,tipo:'ENTRADA',cantidad:r.cantidad,unidad:r.unidad,saldo_anterior:0,saldo_resultante:r.cantidad,fecha:new Date(),id_usuario:usuario,id_ubicacion_destino:dest??null},t);
            if(o.modalidad==='COMPRA')await ledger(r.id_producto,r.cantidad,'ENTRADA');
            if(tipo==='PROCESADO')await sql('UPDATE produccion_procesado_detalles SET id_lote_resultado = :lot WHERE id = :id',{lot:lotId,id:saved.resultados[index].id},t);
            else await sql('UPDATE produccion_envasados SET id_lote_resultado = :lot WHERE id_operacion = :id',{lot:lotId,id:o.id},t);
        }
        const updates=tipo==='PROCESADO'?{peso_salida_kg:d.peso_salida_kg,id_ubicacion:dest??null}:{peso_total_kg:d.peso_total_kg,cantidad_destino:d.cantidad_destino,unidad_destino:d.unidad_destino,equivalencia_kg_origen:d.equivalencia_kg_origen,equivalencia_kg_destino:d.equivalencia_kg_destino,id_ubicacion:dest??null};
        await sql(`UPDATE ${tabla(tipo)} SET ${Object.keys(updates).map(k=>k+' = :'+k).join(',')} WHERE id_operacion = :id`,{...updates,id:o.id},t);
        await sql("UPDATE produccion_operaciones SET estado='CONFIRMADO',clave_confirmacion = :key,id_usuario_confirmacion = :usuario,confirmado_at=NOW(),updated_at=NOW(),version=version+1 WHERE id = :id",{key,usuario,id:o.id},t);
        await audit(o.id,'CONFIRMAR',{estado:o.estado},{estado:'CONFIRMADO',origenes:d.origenes,resultados:results},usuario,t);return obtenerTransformacion(tipo,o.id,t);
    },externa);
}
export async function anularTransformacion(tipo:Transformacion,id:unknown,raw:Fila,usuario:number,externa?:Transaction){
    const motivo=typeof raw.motivo==='string'?raw.motivo.trim():'';if(motivo.length<5||motivo.length>1000)throw new ErrorDescarguio('Indique un motivo de 5 a 1000 caracteres.',400,{motivo:'Explique el motivo.'});
    return tx(async t=>{
        const o=await lock(tipo,id,t);if(o.estado==='ANULADO')return obtenerTransformacion(tipo,o.id,t);checkVersion(o,raw);
        if(!['BORRADOR','CONFIRMADO'].includes(o.estado))throw new ErrorDescarguio('Estado no anulable.',409);
        if(o.estado==='CONFIRMADO'){
            const resultLots=await leerDesc('SELECT * FROM produccion_lotes WHERE id_operacion_origen = :id ORDER BY id FOR UPDATE',{id:o.id},t);
            for(const l of resultLots){
                const deps=await leerDesc(`SELECT r.id FROM produccion_etapa_origenes r JOIN produccion_operaciones oo ON oo.id=r.id_operacion WHERE r.id_lote = :id AND oo.estado <> 'ANULADO' LIMIT 1`,{id:l.id},t);
                const other=await leerDesc(`SELECT m.id FROM produccion_movimientos m JOIN produccion_operaciones oo ON oo.id=m.id_operacion WHERE m.id_lote = :id AND m.id_operacion <> :op AND oo.estado <> 'ANULADO' LIMIT 1`,{id:l.id,op:o.id},t);
                if(deps.length||other.length||l.estado!=='ACTIVO'||mil(l.cantidad_disponible)!==mil(l.cantidad_inicial))throw new ErrorDescarguio('El resultado tiene consumo o procesos relacionados. Anúlelos primero.',409);
            }
            const links=await leerDesc(`SELECT v.*,m.id_producto,m.cantidad,m.tipo FROM produccion_inventario_vinculos v JOIN movimientos_inventario m ON m.id=v.id_movimiento WHERE v.id_operacion = :id ORDER BY v.id DESC`,{id:o.id},t);
            const ps=await productos(links.map(r=>Number(r.id_producto)),t);
            for(const l of resultLots)if(l.modalidad==='COMPRA'){
                const [active]=await leerDesc("SELECT COALESCE(SUM(cantidad_disponible),0) n FROM produccion_lotes WHERE id_producto = :id AND modalidad='COMPRA' AND estado='ACTIVO'",{id:l.id_producto},t);
                const reserve=await ReservaProducto.findByPk(l.id_producto,{transaction:t,lock:t.LOCK.UPDATE});
                if(mil(active.n)>mil(ps.get(Number(l.id_producto)).model.get('stock'))-mil(reserve?.get('cantidad')))throw new ErrorDescarguio('El stock del resultado ya está vendido, reservado o no respalda los lotes. No es posible revertirlo.',409);
            }
            for(const v of links){if(v.id_movimiento_reverso)throw new ErrorDescarguio('Existe una reversión previa inconsistente.',409);const movement=await moverInventario(o,ps.get(Number(v.id_producto)),Number(v.cantidad),v.tipo==='ENTRADA'?'SALIDA':'ENTRADA',usuario,t,motivo,true);await sql('UPDATE produccion_inventario_vinculos SET id_movimiento_reverso = :m WHERE id = :id',{m:movement,id:v.id},t);}
            const movements=await leerDesc("SELECT * FROM produccion_movimientos WHERE id_operacion = :id AND tipo IN ('ENTRADA','SALIDA') ORDER BY id_lote",{id:o.id},t);
            for(const m of movements){const [l]=await leerDesc('SELECT * FROM produccion_lotes WHERE id = :id FOR UPDATE',{id:m.id_lote},t),input=m.tipo==='SALIDA',after=input?mil(l.cantidad_disponible)+mil(m.cantidad):0;
                if(input&&(l.estado==='ANULADO'||after>mil(l.cantidad_inicial)))throw new ErrorDescarguio('El saldo del origen no permite restaurarlo.',409);
                await insert('produccion_movimientos',{clave:`${tipo}:${o.id}:REVERSO:${m.id}`,id_operacion:o.id,id_lote:l.id,tipo:'REVERSO',cantidad:m.cantidad,unidad:m.unidad,saldo_anterior:l.cantidad_disponible,saldo_resultante:after/1000,id_movimiento_revertido:m.id,fecha:new Date(),id_usuario:usuario,observacion:motivo},t);
                await sql('UPDATE produccion_lotes SET cantidad_disponible = :after,estado = :estado,version=version+1,updated_at=NOW() WHERE id = :id',{after:after/1000,estado:input?'ACTIVO':'ANULADO',id:l.id},t);
            }
        }
        await sql("UPDATE produccion_operaciones SET estado='ANULADO',motivo_anulacion = :motivo,id_usuario_anulacion = :usuario,anulado_at=NOW(),version=version+1,updated_at=NOW() WHERE id = :id",{motivo,usuario,id:o.id},t);
        await audit(o.id,'ANULAR',{estado:o.estado},{estado:'ANULADO'},usuario,t,motivo);return obtenerTransformacion(tipo,o.id,t);
    },externa);
}
