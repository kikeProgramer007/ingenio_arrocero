import { valoresFiltro, idsFiltro } from '../utils/filtros-multiples-produccion';
import { Transaction } from 'sequelize';
import { Transformacion } from '../dtos/produccion-transformacion.dto';
import { FilaEtapa as Fila } from '../dtos/produccion-etapa.dto';
import { ErrorDescarguio } from '../dtos/descarguio.dto';
import { filtrosProduccion } from './produccion-consulta.servicio';
import { leerDesc } from './descarguios.servicio';
import { resumenTransformacion } from './produccion-transformaciones.servicio';
import { aplicarPlantillaFormal, HojaExport } from '../utils/exportar';

function consulta(tipo:Transformacion,q:Fila){
    const f=filtrosProduccion({...q,tipo:undefined,orden:'fecha',buscar:q.buscar||q.q},100),params:Fila={tipo},where=['o.tipo = :tipo'];
    if(f.desde){where.push('o.fecha >= :desde');params.desde=f.desde+' 00:00:00';}if(f.hasta){where.push('o.fecha < DATE_ADD(:hasta,INTERVAL 1 DAY)');params.hasta=f.hasta;}
    if(f.productor){where.push('o.id_productor IN (:productor)');params.productor=f.productor;}if(f.modalidad){where.push('o.modalidad IN (:modalidad)');params.modalidad=f.modalidad;}
    if(q.estado){valoresFiltro(q.estado,['BORRADOR','CONFIRMADO','ANULADO']);where.push('o.estado IN (:estado)');params.estado=valoresFiltro(q.estado);}
    for(const k of ['variedad','presentacion'])if(q[k]){valoresFiltro(q[k]);if(k==='presentacion'&&tipo!=='ENVASADO')continue;where.push((k==='variedad'?'r.variedad':'d.presentacion')+' IN (:'+k+')');params[k]=valoresFiltro(q[k]);}
    if(q.id_producto){idsFiltro(q.id_producto);where.push(tipo==='ENVASADO'?'d.id_producto_destino IN (:producto)':'EXISTS (SELECT 1 FROM produccion_procesado_detalles dp WHERE dp.id_operacion=o.id AND dp.id_producto IN (:producto))');params.producto=idsFiltro(q.id_producto);}
    if(f.buscar){where.push('(LOCATE(:q,o.codigo)>0 OR LOCATE(:q,r.origen)>0 OR LOCATE(:q,p.nombre)>0)');params.q=f.buscar;}
    const orders:Fila={fecha:'o.fecha',codigo:'o.codigo',productor:'p.nombre',modalidad:'o.modalidad',variedad:'r.variedad',cantidad:'r.cantidad',estado:'o.estado'};
    const order=q.orden||'fecha';if(!orders[order])throw new ErrorDescarguio('Columna de orden inválida.');
    const joins=`FROM produccion_operaciones o JOIN ${tipo==='PROCESADO'?'produccion_procesados':'produccion_envasados'} d ON d.id_operacion=o.id
        LEFT JOIN proveedores p ON p.id=o.id_productor LEFT JOIN produccion_ubicaciones u ON u.id=d.id_ubicacion
        ${tipo==='ENVASADO'?'LEFT JOIN productos pd ON pd.id=d.id_producto_destino':''}
        LEFT JOIN (SELECT e.id_operacion,SUM(e.cantidad) cantidad,MIN(l.unidad) unidad,MIN(l.variedad) variedad,
            GROUP_CONCAT(DISTINCT oo.codigo ORDER BY oo.codigo SEPARATOR ', ') origen,
            GROUP_CONCAT(DISTINCT l.variedad ORDER BY l.variedad SEPARATOR ', ') variedades
            FROM produccion_etapa_origenes e JOIN produccion_lotes l ON l.id=e.id_lote JOIN produccion_operaciones oo ON oo.id=l.id_operacion_origen
            GROUP BY e.id_operacion) r ON r.id_operacion=o.id
        LEFT JOIN (SELECT e.id_operacion,
            GROUP_CONCAT(DISTINCT o0.codigo ORDER BY o0.codigo SEPARATOR ', ') secados,
            GROUP_CONCAT(DISTINCT o1.codigo ORDER BY o1.codigo SEPARATOR ', ') descarguios,
            GROUP_CONCAT(DISTINCT dc1.boleta ORDER BY dc1.boleta SEPARATOR ', ') boletas
            FROM produccion_etapa_origenes e JOIN produccion_lotes l ON l.id=e.id_lote JOIN produccion_operaciones oo ON oo.id=l.id_operacion_origen
            LEFT JOIN produccion_etapa_origenes e0 ON e0.id_operacion=oo.id
            LEFT JOIN produccion_lotes l0 ON l0.id=e0.id_lote
            LEFT JOIN produccion_operaciones o0 ON o0.id=l0.id_operacion_origen
            LEFT JOIN produccion_etapa_origenes e1 ON e1.id_operacion=o0.id
            LEFT JOIN produccion_lotes l1 ON l1.id=e1.id_lote
            LEFT JOIN produccion_operaciones o1 ON o1.id=l1.id_operacion_origen
            LEFT JOIN produccion_descarguios dc1 ON dc1.id_operacion=o1.id
            GROUP BY e.id_operacion) ra ON ra.id_operacion=o.id`;
    return {f,params,where:where.join(' AND '),joins,order:orders[order]};
}
export async function filasTransformacion(tipo:Transformacion,q:Fila,todas=false,t?:Transaction){
    const c=consulta(tipo,q),items=await leerDesc(`SELECT o.id,o.codigo,o.fecha,o.estado,o.modalidad,o.version,o.responsable,o.observacion,p.nombre productor,r.origen,ra.secados,ra.descarguios,ra.boletas,r.variedad,r.cantidad,r.unidad,COALESCE(u.nombre,d.destino_nombre) ubicacion,d.ubicacion_detalle,
        ${tipo==='PROCESADO'?'d.peso_entrada_kg,d.peso_salida_kg,d.merma_medida,d.unidad_merma':'pd.nombre producto,d.id_producto_destino,d.presentacion,d.numero_bolsas,d.peso_total_kg,d.cantidad_destino,d.unidad_destino'}
        ${c.joins} WHERE ${c.where} ORDER BY ${c.order} ${c.f.direccion},o.id ${c.f.direccion} ${todas?'':'LIMIT :limit OFFSET :offset'}`,{...c.params,limit:c.f.limit,offset:c.f.offset},t);
    if(tipo==='PROCESADO'&&items.length){const details=await leerDesc(`SELECT d.*,p.nombre producto FROM produccion_procesado_detalles d LEFT JOIN productos p ON p.id=d.id_producto WHERE d.id_operacion IN (:ids) ORDER BY d.id`,{ids:items.map(i=>i.id)},t);
        for(const i of items){i.resultados=details.filter(d=>Number(d.id_operacion)===Number(i.id));i.resumen=resumenTransformacion(tipo,i,[{cantidad:i.cantidad,unidad:i.unidad}]);}
    }return items;
}
export async function listarTransformacion(tipo:Transformacion,q:Fila,t?:Transaction){
    const c=consulta(tipo,q),[counts]=await leerDesc(`SELECT COUNT(*) total,COALESCE(SUM(o.estado='CONFIRMADO'),0) confirmados,COALESCE(SUM(o.estado='BORRADOR'),0) borradores,COALESCE(SUM(o.estado='ANULADO'),0) anulados ${c.joins} WHERE ${c.where}`,c.params,t);
    const cantidades=await leerDesc(`SELECT o.modalidad,o.estado,r.unidad,SUM(r.cantidad) cantidad ${c.joins} WHERE ${c.where} GROUP BY o.modalidad,o.estado,r.unidad`,c.params,t);
    const resultados=tipo==='PROCESADO'?await leerDesc(`SELECT o.modalidad,pd.nombre producto,dd.unidad,SUM(dd.cantidad) cantidad ${c.joins} JOIN produccion_procesado_detalles dd ON dd.id_operacion=o.id JOIN productos pd ON pd.id=dd.id_producto WHERE ${c.where} AND o.estado='CONFIRMADO' GROUP BY o.modalidad,pd.nombre,dd.unidad`,c.params,t):
        await leerDesc(`SELECT o.modalidad,pd.nombre producto,d.unidad_destino unidad,SUM(d.cantidad_destino) cantidad,SUM(d.numero_bolsas) envases ${c.joins} WHERE ${c.where} AND o.estado='CONFIRMADO' GROUP BY o.modalidad,pd.nombre,d.unidad_destino`,c.params,t);
    let rendimiento:number|null=null;
    if(tipo==='PROCESADO'){
        const [pesos]=await leerDesc(`SELECT COUNT(*) n,SUM(CASE WHEN r.unidad='Kilo' THEN r.cantidad ELSE d.peso_entrada_kg END) entrada,SUM(d.peso_salida_kg) salida,
            SUM((CASE WHEN r.unidad='Kilo' THEN r.cantidad ELSE d.peso_entrada_kg END) IS NULL OR d.peso_salida_kg IS NULL) incompletos
            ${c.joins} WHERE ${c.where} AND o.estado='CONFIRMADO'`,c.params,t);
        if(Number(pesos.n)>0&&!Number(pesos.incompletos)&&Number(pesos.entrada)>0)rendimiento=Number(pesos.salida)/Number(pesos.entrada)*100;
    }
    return {items:await filasTransformacion(tipo,q,false,t),total:Number(counts.total),resumen:{...counts,cantidades,resultados,rendimiento}};
}
export async function opcionesTransformacion(tipo:Transformacion,q:Fila,t?:Transaction){
    const limiteCatalogo = String(q.todos) === '1' ? '' : ' LIMIT 50';
    const buscar=String(q.q||'').trim(),id=q.id?Number(q.id):null;if(buscar.length>150||id!=null&&(!Number.isSafeInteger(id)||id<=0))throw new ErrorDescarguio('Búsqueda inválida.');
    if(q.grupo==='lotes')return leerDesc(`SELECT l.*,oo.codigo origen_codigo,oo.fecha origen_fecha,p.nombre productor,pr.nombre producto,dp.clasificacion,oo.codigo etiqueta
        FROM produccion_lotes l JOIN produccion_operaciones oo ON oo.id=l.id_operacion_origen JOIN productos pr ON pr.id=l.id_producto LEFT JOIN proveedores p ON p.id=l.id_productor
        LEFT JOIN produccion_procesado_detalles dp ON dp.id_lote_resultado=l.id
        WHERE l.etapa = :etapa AND oo.estado='CONFIRMADO' AND (:id IS NOT NULL AND l.id = :id OR :id IS NULL AND l.estado='ACTIVO' AND l.cantidad_disponible > 0 AND
        (LOCATE(:q,oo.codigo)>0 OR LOCATE(:q,l.codigo)>0 OR LOCATE(:q,pr.nombre)>0)) ORDER BY oo.fecha,l.id${limiteCatalogo}`,{q:buscar,id,etapa:tipo==='PROCESADO'?'GUARDADO':'PROCESADO'},t);
    if(q.grupo==='productos'||q.grupo==='empaques')return leerDesc(`SELECT p.id,p.nombre,p.unidad_medida,p.stock,c.nombre categoria FROM productos p LEFT JOIN categorias_producto c ON c.id=p.id_categoria
        WHERE p.eliminado=0 ${q.grupo==='empaques'?`AND LOWER(p.unidad_medida) IN ('unidad','unidades','und') AND
            (LOWER(COALESCE(c.nombre,'')) REGEXP 'bolsa|empaque|arpillera' OR LOWER(p.nombre) REGEXP 'bolsa|empaque|arpillera' AND LOWER(p.nombre) NOT REGEXP 'arroz|granillo|afrecho')`:''}
        AND (:id IS NOT NULL AND p.id = :id OR :id IS NULL AND LOCATE(:q,p.nombre)>0) ORDER BY p.nombre,p.id${limiteCatalogo}`,{q:buscar,id},t);
    if(q.grupo==='productores')return leerDesc(`SELECT id,nombre FROM proveedores WHERE activo=1 AND LOCATE(:q,nombre)>0 ORDER BY nombre,id${limiteCatalogo}`,{q:buscar},t);
    if(q.grupo==='ubicaciones')return leerDesc(`SELECT id,nombre FROM produccion_ubicaciones WHERE activo=1 AND LOCATE(:q,nombre)>0 ORDER BY nombre${limiteCatalogo}`,{q:buscar},t);
    throw new ErrorDescarguio('Catálogo inválido.');
}
export async function hojaTransformacion(tipo:Transformacion,q:Fila,formato:'pdf'|'xlsx',t?:Transaction):Promise<HojaExport>{
    const rows=await filasTransformacion(tipo,q,true,t),process=tipo==='PROCESADO',num=(n:any)=>n==null?'No medido':new Intl.NumberFormat('es-BO',{maximumFractionDigits:3}).format(Number(n));
    const filtros=[{label:'Desde',valor:q.fecha_desde||'Sin límite'},{label:'Hasta',valor:q.fecha_hasta||'Sin límite'}];
    if(q.id_productor){const productores=await leerDesc('SELECT nombre FROM proveedores WHERE id IN (:id)',{id:idsFiltro(q.id_productor)},t); const p={nombre:productores.map(p=>p.nombre).join(', ')};filtros.push({label:'Productor',valor:p?.nombre||'No encontrado'});}
    if(q.id_producto){const [p]=await leerDesc('SELECT nombre FROM productos WHERE id = :id',{id:Number(q.id_producto)},t);filtros.push({label:'Producto',valor:p?.nombre||'No encontrado'});}
    const labels:Fila={modalidad:'Modalidad',variedad:'Variedad',presentacion:'Presentación',estado:'Estado',buscar:'Búsqueda',q:'Búsqueda'};
    for(const k of Object.keys(labels))if(q[k])filtros.push({label:labels[k],valor:String(q[k])});
    const normalizar=(v:unknown)=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const resultadoPorGrupo=(r:Fila,grupo:string)=>{
        const partes=(r.resultados||[]).filter((d:Fila)=>{
            const texto=normalizar(`${d.clasificacion||''} ${d.producto||''}`);
            if(grupo==='rechazo')return /rech|descarte/.test(texto);
            if(grupo==='granillo')return /granillo/.test(texto);
            if(grupo==='tresCuartos')return /3\s*\/\s*4|¾/.test(texto);
            if(grupo==='entero')return /entero/.test(texto)&&! /3\s*\/\s*4|¾/.test(texto);
            return !/rech|descarte|granillo|entero|3\s*\/\s*4|¾/.test(texto);
        });
        if(!partes.length)return '—';
        const porUnidad=new Map<string,number>();
        for(const d of partes){const u=String(d.unidad||'sin unidad');porUnidad.set(u,(porUnidad.get(u)||0)+Number(d.cantidad||0));}
        return [...porUnidad].map(([u,c])=>`${num(c)} ${u}`).join('\n');
    };
    const totalPorUnidad=(r:Fila)=>{const porUnidad=new Map<string,number>();for(const d of r.resultados||[]){const u=String(d.unidad||'sin unidad');porUnidad.set(u,(porUnidad.get(u)||0)+Number(d.cantidad||0));}return [...porUnidad].map(([u,c])=>`${num(c)} ${u}`).join('\n')||'—';};
    const hoja=aplicarPlantillaFormal({nombre:process?'Procesados':'Envasados',titulo:process?'CONTROL DE PROCESADOS DE ARROZ':'CONTROL DE ENVASADOS DE ARROZ',orientacion:'landscape',textoCompleto:true,mostrarTotalesAutomaticos:false,
        proporcionesColumnas:process?{'N°':18,'Procesado':42,'Secado(s)':50,'Descarguío(s)':54,'Fecha':42,'Boleta(s)':54,'Variedad':42,'Productor':78,'Chala consumida':48,'Unidad':34,'Arroz entero':50,'3/4':45,'Granillo':45,'Rechazo':45,'Otros productos':64,'Total por unidad':58,'Peso entrada (kg)':50,'Peso salida (kg)':50,'Rendimiento (%)':48,'Observaciones':70,'Estado':38}:
            {'N°':18,'Código':65,'Fecha':53,'Producto':95,'Propietario':100,'Presentación':80,'Envases':40,'Peso envasado (kg)':55,'Ubicación':85,'Estado':65},
        formatosNumericos:{'Chala consumida':'#,##0.###',Envases:'0','Peso envasado (kg)':'#,##0.###'},columnas:process?['Procesado','Secado(s)','Descarguío(s)','Fecha','Boleta(s)','Variedad','Productor','Chala consumida','Unidad','Arroz entero','3/4','Granillo','Rechazo','Otros productos','Total por unidad','Peso entrada (kg)','Peso salida (kg)','Rendimiento (%)','Observaciones','Estado']:
            ['Código','Fecha','Producto','Propietario','Presentación','Envases','Peso envasado (kg)','Ubicación','Estado'],
        filas:rows.map(r=>{const date=new Intl.DateTimeFormat('es-BO',{timeZone:'America/La_Paz'}).format(new Date(r.fecha));return process?[r.codigo,r.secados||r.origen||'No informado',r.descarguios||'No informado',date,r.boletas||'No informada',r.variedad||'No informada',r.productor||'No informado',formato==='xlsx'&&r.cantidad!=null?Number(r.cantidad):num(r.cantidad),r.unidad||'—',resultadoPorGrupo(r,'entero'),resultadoPorGrupo(r,'tresCuartos'),resultadoPorGrupo(r,'granillo'),resultadoPorGrupo(r,'rechazo'),resultadoPorGrupo(r,'otros'),totalPorUnidad(r),r.peso_entrada_kg==null?'No medido':formato==='xlsx'?Number(r.peso_entrada_kg):num(r.peso_entrada_kg),r.peso_salida_kg==null?'No medido':formato==='xlsx'?Number(r.peso_salida_kg):num(r.peso_salida_kg),num(r.resumen.rendimiento),r.observacion||'—',r.estado]:
            [r.codigo,date,r.producto||'Pendiente',r.modalidad==='COMPRA'?'Ingenio (propio)':r.productor||'Pendiente',r.presentacion||'Pendiente',formato==='xlsx'&&r.numero_bolsas!=null?Number(r.numero_bolsas):num(r.numero_bolsas),formato==='xlsx'&&r.peso_total_kg!=null?Number(r.peso_total_kg):num(r.peso_total_kg),[r.ubicacion,r.ubicacion_detalle].filter(Boolean).join(' / ')||'No informada',r.estado];}),resumen:[{label:'Operaciones',valor:String(rows.length)}]
    },filtros);
    hoja.mostrarFirma=false;return hoja;
}
