import { valoresFiltro, idsFiltro } from '../utils/filtros-multiples-produccion';
import { Transaction } from 'sequelize';
import { Etapa, FilaEtapa as Fila } from '../dtos/produccion-etapa.dto';
import { ErrorDescarguio } from '../dtos/descarguio.dto';
import { filtrosProduccion } from './produccion-consulta.servicio';
import { leerDesc } from './descarguios.servicio';
import { aplicarPlantillaFormal, HojaExport } from '../utils/exportar';

const tabla = (tipo: Etapa) => tipo === 'SECADO' ? 'produccion_secados':'produccion_guardados';
export const proporcionesEtapa = (tipo: Etapa): Record<string,number> => tipo === 'SECADO'
    ? {'N°':18,'Secado':42,'Descarguío':42,'Fecha':42,'Operador':65,'Silo':40,'Secadora':48,'H. entrada (%)':42,'H. salida (%)':42,'Variedad':42,'Productor':78,'Boleta':48,'Cantidad':42,'Unidad':34,'Modalidad':42,'Ubicación':52,'Observaciones':70,'Estado':38}
    : {'N°':18,'Guardado':42,'Secado(s)':54,'Descarguío(s)':54,'Fecha':42,'N° boleta':48,'Productor':78,'Variedad':42,'Cantidad':42,'Unidad':34,'H. entrada (%)':42,'H. salida (%)':42,'Imp. entrada (%)':42,'Imp. salida (%)':42,'Ubicación':60,'Detalle':58,'Modalidad':42,'Observaciones':70,'Estado':38};
function consulta(tipo: Etapa, query: Fila) {
    const f = filtrosProduccion({...query,tipo:undefined,orden:'fecha',buscar:query.buscar || query.q},100);
    const params: Fila = {tipo}, where = ['o.tipo = :tipo'];
    if (f.desde) { where.push('o.fecha >= :desde'); params.desde = `${f.desde} 00:00:00`; }
    if (f.hasta) { where.push('o.fecha < DATE_ADD(:hasta,INTERVAL 1 DAY)'); params.hasta=f.hasta; }
    if (f.productor) { where.push('o.id_productor IN (:productor)'); params.productor=f.productor; }
    if (f.modalidad) { where.push('o.modalidad IN (:modalidad)'); params.modalidad=f.modalidad; }
    if (query.estado) {
        valoresFiltro(query.estado, ['BORRADOR','CONFIRMADO','ANULADO']);
        where.push('o.estado IN (:estado)'); params.estado=valoresFiltro(query.estado);
    }
    for (const k of ['variedad','secadora','ubicacion']) {
        if (!query[k]) continue;
        valoresFiltro(query[k]);
        if (k === 'secadora' && tipo !== 'SECADO') continue;
        const field = k === 'variedad' ? 'r.variedad' : k === 'ubicacion' ? 'COALESCE(u.nombre,d.destino_nombre)' : 'd.secadora';
        where.push(`${field} IN (:${k})`); params[k] = valoresFiltro(query[k]);
    }
    if (f.buscar) { where.push('(LOCATE(:q,o.codigo)>0 OR LOCATE(:q,p.nombre)>0 OR LOCATE(:q,r.origen)>0 OR LOCATE(:q,ra.boleta)>0)'); params.q=f.buscar; }
    const orders: Fila = {fecha:'o.fecha',codigo:'o.codigo',productor:'p.nombre',estado:'o.estado',variedad:'r.variedad',cantidad:'r.cantidad',origen:'r.origen',ubicacion:'ubicacion'};
    if (tipo === 'SECADO') Object.assign(orders,{secadora:'d.secadora',humedad_entrada:'d.humedad_entrada',humedad_salida:'d.humedad_salida',duracion:'TIMESTAMPDIFF(MINUTE,d.inicio,d.fin)'});
    const orden = query.orden || 'fecha'; if (!orders[orden]) throw new ErrorDescarguio('Columna de orden inválida.');
    const joins = `FROM produccion_operaciones o JOIN ${tabla(tipo)} d ON d.id_operacion=o.id
        LEFT JOIN proveedores p ON p.id=o.id_productor LEFT JOIN produccion_ubicaciones u ON u.id=d.id_ubicacion
        LEFT JOIN (SELECT e.id_operacion,SUM(e.cantidad) cantidad,MIN(l.unidad) unidad,MIN(l.variedad) variedad,
            GROUP_CONCAT(DISTINCT oo.codigo ORDER BY oo.codigo SEPARATOR ', ') origen
            FROM produccion_etapa_origenes e JOIN produccion_lotes l ON l.id=e.id_lote JOIN produccion_operaciones oo ON oo.id=l.id_operacion_origen
            GROUP BY e.id_operacion) r ON r.id_operacion=o.id
        LEFT JOIN (SELECT e.id_operacion,
            GROUP_CONCAT(DISTINCT o0.codigo ORDER BY o0.codigo SEPARATOR ', ') descarguio,
            GROUP_CONCAT(DISTINCT COALESCE(dc.boleta,dc0.boleta) ORDER BY COALESCE(dc.boleta,dc0.boleta) SEPARATOR ', ') boleta,
            GROUP_CONCAT(DISTINCT sd.humedad_entrada ORDER BY sd.humedad_entrada SEPARATOR ', ') humedad_entrada,
            GROUP_CONCAT(DISTINCT sd.humedad_salida ORDER BY sd.humedad_salida SEPARATOR ', ') humedad_salida,
            GROUP_CONCAT(DISTINCT sd.silo ORDER BY sd.silo SEPARATOR ', ') silo,
            GROUP_CONCAT(DISTINCT sd.operador ORDER BY sd.operador SEPARATOR ', ') operador
            FROM produccion_etapa_origenes e JOIN produccion_lotes l ON l.id=e.id_lote JOIN produccion_operaciones oo ON oo.id=l.id_operacion_origen
            LEFT JOIN produccion_descarguios dc ON dc.id_operacion=oo.id
            LEFT JOIN produccion_secados sd ON sd.id_operacion=oo.id
            LEFT JOIN produccion_etapa_origenes e0 ON e0.id_operacion=oo.id
            LEFT JOIN produccion_lotes l0 ON l0.id=e0.id_lote
            LEFT JOIN produccion_operaciones o0 ON o0.id=l0.id_operacion_origen
            LEFT JOIN produccion_descarguios dc0 ON dc0.id_operacion=o0.id
            GROUP BY e.id_operacion) ra ON ra.id_operacion=o.id`;
    return {f,params,where:where.join(' AND '),joins,order:orders[orden]};
}
export async function filasEtapa(tipo: Etapa, query: Fila, todas=false, t?: Transaction) {
    const c=consulta(tipo,query);
    return leerDesc(`SELECT o.id,o.codigo,o.fecha,o.estado,o.modalidad,o.version,o.responsable,o.observacion,p.nombre productor,r.origen,ra.descarguio,ra.boleta,ra.humedad_entrada humedad_origen_entrada,ra.humedad_salida humedad_origen_salida,r.variedad,r.cantidad,r.unidad,
        COALESCE(u.nombre,d.destino_nombre) ubicacion,d.ubicacion_detalle,
        ${tipo === 'SECADO' ? 'd.proc,d.secadora,d.silo,d.operador,d.humedad_entrada,d.humedad_salida,TIMESTAMPDIFF(MINUTE,d.inicio,d.fin) duracion' : `d.condicion,d.orden_guardado,
            (SELECT SUM(lr.cantidad_disponible) FROM produccion_etapa_origenes er JOIN produccion_lotes lr ON lr.id=er.id_lote_resultado WHERE er.id_operacion=o.id) disponible`}
        ${c.joins} WHERE ${c.where} ORDER BY ${c.order} ${c.f.direccion},o.id ${c.f.direccion} ${todas ? '' : 'LIMIT :limit OFFSET :offset'}`,
        {...c.params,limit:c.f.limit,offset:c.f.offset},t);
}
export async function listarEtapa(tipo: Etapa, query: Fila, t?: Transaction) {
    const c=consulta(tipo,query);
    const [count]=await leerDesc(`SELECT COUNT(*) total,COALESCE(SUM(o.estado='CONFIRMADO'),0) confirmados,COALESCE(SUM(o.estado='BORRADOR'),0) borradores,COALESCE(SUM(o.estado='ANULADO'),0) anulados ${c.joins} WHERE ${c.where}`,c.params,t);
    const cantidades=await leerDesc(`SELECT o.modalidad,o.estado,r.unidad,SUM(r.cantidad) cantidad ${c.joins} WHERE ${c.where} GROUP BY o.modalidad,o.estado,r.unidad`,c.params,t);
    return {items:await filasEtapa(tipo,query,false,t),total:Number(count.total),resumen:{...count,cantidades}};
}
export async function opcionesEtapa(tipo: Etapa, query: Fila, t?: Transaction) {
    const limiteCatalogo = String(query.todos) === '1' ? '' : ' LIMIT 50';
    const q=String(query.q || '').trim(); if (q.length>150) throw new ErrorDescarguio('Búsqueda demasiado extensa.');
    const id=query.id ? Number(query.id):null;
    if (id != null && (!Number.isSafeInteger(id)||id<=0)) throw new ErrorDescarguio('Identificador inválido.');
    if (query.grupo === 'lotes') return leerDesc(`SELECT l.*,o.codigo origen_codigo,o.fecha origen_fecha,p.nombre productor,pr.nombre producto,
        COALESCE(s.humedad_salida,d.humedad_entrada) humedad_origen,u.nombre ubicacion_nombre,d.boleta,o.responsable responsable_origen,
        o.codigo etiqueta
        FROM produccion_lotes l JOIN produccion_operaciones o ON o.id=l.id_operacion_origen
        LEFT JOIN proveedores p ON p.id=l.id_productor LEFT JOIN productos pr ON pr.id=l.id_producto
        LEFT JOIN produccion_ubicaciones u ON u.id=l.id_ubicacion
        LEFT JOIN produccion_secados s ON s.id_operacion=o.id LEFT JOIN produccion_descarguios d ON d.id_operacion=o.id
        WHERE l.etapa = :etapa AND o.estado='CONFIRMADO' AND (:id IS NOT NULL AND l.id = :id OR :id IS NULL AND l.estado='ACTIVO' AND l.cantidad_disponible > 0
        AND (LOCATE(:q,o.codigo)>0 OR LOCATE(:q,l.codigo)>0 OR LOCATE(:q,COALESCE(d.boleta,''))>0)) ORDER BY o.fecha,l.id${limiteCatalogo}`,{q,id,etapa:tipo === 'SECADO' ? 'DESCARGUIO':'SECADO'},t);
    if (query.grupo === 'productores') return leerDesc(`SELECT id,nombre FROM proveedores WHERE activo=1 AND LOCATE(:q,nombre)>0 ORDER BY nombre,id${limiteCatalogo}`,{q},t);
    if (query.grupo === 'ubicaciones') return leerDesc(`SELECT id,nombre FROM produccion_ubicaciones WHERE activo=1 AND LOCATE(:q,nombre)>0 ORDER BY nombre${limiteCatalogo}`,{q},t);
    if (query.grupo === 'secadoras' && tipo === 'SECADO') return leerDesc(`SELECT DISTINCT secadora nombre FROM produccion_secados WHERE secadora IS NOT NULL AND LOCATE(:q,secadora)>0 ORDER BY secadora${limiteCatalogo}`,{q},t);
    throw new ErrorDescarguio('Catálogo inválido.');
}
export async function hojaEtapa(tipo: Etapa, query: Fila, formato: 'pdf'|'xlsx', t?: Transaction): Promise<HojaExport> {
    consulta(tipo,query);
    const rows=await filasEtapa(tipo,query,true,t), sec=tipo==='SECADO';
    const n=(v:any)=>v==null ? 'No medido':new Intl.NumberFormat('es-BO',{maximumFractionDigits:3}).format(Number(v));
    const totals=new Map<string,number>();
    for (const r of rows) if(r.estado==='CONFIRMADO' && r.unidad) { const k=`${r.modalidad} / ${r.unidad}`; totals.set(k,(totals.get(k)||0)+Math.round(Number(r.cantidad)*1000)); }
    let productor='Todos';
    if(query.id_productor) { const productores=await leerDesc('SELECT nombre FROM proveedores WHERE id IN (:id)',{id:idsFiltro(query.id_productor)},t); const p={nombre:productores.map(p=>p.nombre).join(', ')}; productor=p?.nombre||'No encontrado'; }
    const columnas=sec?['Secado','Descarguío','Fecha','Operador','Silo','Secadora','H. entrada (%)','H. salida (%)','Variedad','Productor','Boleta','Cantidad','Unidad','Modalidad','Ubicación','Observaciones','Estado']:
        ['Guardado','Secado(s)','Descarguío(s)','Fecha','N° boleta','Productor','Variedad','Cantidad','Unidad','H. entrada (%)','H. salida (%)','Imp. entrada (%)','Imp. salida (%)','Ubicación','Detalle','Modalidad','Observaciones','Estado'];
    const hoja = aplicarPlantillaFormal({nombre:sec?'Secados':'Guardados',titulo:sec?'CONTROL DE SECADOS DE ARROZ':'CONTROL DE GUARDADOS DE ARROZ',orientacion:'landscape',textoCompleto:true,proporcionesColumnas:proporcionesEtapa(tipo),mostrarTotalesAutomaticos:false,formatosNumericos:{Cantidad:'#,##0.###'},columnas,
        filas:rows.map(r=>{const cantidad=r.cantidad==null?'No informada':formato==='xlsx'?Number(r.cantidad):n(r.cantidad),fecha=new Intl.DateTimeFormat('es-BO',{timeZone:'America/La_Paz'}).format(new Date(r.fecha));return sec?
            [r.codigo,r.origen||'No informado',fecha,r.operador||r.responsable||'No informado',r.silo||'No informado',r.secadora||'No informada',n(r.humedad_entrada),n(r.humedad_salida),r.variedad||'No informada',r.productor||'No informado',r.boleta||'No informada',cantidad,r.unidad||'—',r.modalidad,r.ubicacion||'No informada',r.observacion||'—',r.estado]:
            [r.codigo,r.origen||'No informado',r.descarguio||'No informado',fecha,r.boleta||'No informada',r.productor||'No informado',r.variedad||'No informada',cantidad,r.unidad||'—',r.humedad_origen_entrada||'No registrada',r.humedad_origen_salida||'No registrada','No registrada','No registrada',r.ubicacion||'No informada',r.ubicacion_detalle||'—',r.modalidad,r.observacion||'—',r.estado];}),
        resumen:[{label:'Operaciones',valor:rows.length},...[...totals].map(([label,v])=>({label,valor:n(v/1000)}))]
    },[{label:'Desde',valor:query.fecha_desde||'Sin límite'},{label:'Hasta',valor:query.fecha_hasta||'Sin límite'},{label:'Productor',valor:productor},
        ...['estado','variedad','secadora','ubicacion','modalidad','buscar'].filter(k=>query[k]).map(k=>({label:k,valor:String(query[k])}))]);
    // Son controles operativos filtrados; no necesitan una hoja adicional de firma.
    hoja.mostrarFirma = false;
    return hoja;
}
