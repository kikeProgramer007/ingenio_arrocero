import { valoresFiltro, idsFiltro } from '../utils/filtros-multiples-produccion';
import { Transaction } from 'sequelize';
import { leerDesc } from './descarguios.servicio';
import { filtrosProduccion, ErrorConsultaProduccion } from './produccion-consulta.servicio';
import { aplicarPlantillaFormal, HojaExport } from '../utils/exportar';

type Datos = Record<string, any>;
// UNION DISTINCT evita multiplicar saldos cuando varias ramas comparten una recepción.
const ancestros = `WITH RECURSIVE ascendencia AS (
 SELECT id nodo,id ascendiente FROM produccion_lotes
 UNION DISTINCT
 SELECT a.nodo,e.id_lote FROM ascendencia a JOIN produccion_lotes l ON l.id=a.ascendiente
 JOIN produccion_etapa_origenes e ON e.id_operacion=l.id_operacion_origen
)`;
const proyeccion = `${ancestros}, vista AS (
 SELECT l.*,o.fecha fecha_operacion,o.codigo documento,o.estado estado_documento,
 p.nombre productor,COALESCE(prop.nombre,'Ingenio (propio)') propietario,pr.nombre producto,
 COALESCE(u.nombre,'Sin ubicación') ubicacion,
 COALESCE(dp.clasificacion,ep.clasificacion,'Sin clasificación') clasificacion,
 (SELECT MIN(ro.fecha) FROM ascendencia a JOIN produccion_lotes rl ON rl.id=a.ascendiente
 JOIN produccion_operaciones ro ON ro.id=rl.id_operacion_origen WHERE a.nodo=l.id AND ro.tipo='DESCARGUIO') fecha,
 (SELECT GROUP_CONCAT(DISTINCT d.boleta ORDER BY d.boleta SEPARATOR ', ') FROM ascendencia a
 JOIN produccion_lotes rl ON rl.id=a.ascendiente JOIN produccion_descarguios d ON d.id_operacion=rl.id_operacion_origen WHERE a.nodo=l.id) boleta
 FROM produccion_lotes l JOIN produccion_operaciones o ON o.id=l.id_operacion_origen
 LEFT JOIN proveedores p ON p.id=l.id_productor LEFT JOIN proveedores prop ON prop.id=l.id_propietario
 LEFT JOIN productos pr ON pr.id=l.id_producto LEFT JOIN produccion_ubicaciones u ON u.id=l.id_ubicacion
 LEFT JOIN produccion_procesado_detalles dp ON dp.id_lote_resultado=l.id
 LEFT JOIN produccion_etapa_origenes ee ON ee.id_operacion=o.id AND o.tipo='ENVASADO'
 LEFT JOIN produccion_procesado_detalles ep ON ep.id_lote_resultado=ee.id_lote
)`;

function consulta(q: Datos) {
 const f=filtrosProduccion({...q,tipo:undefined,orden:'fecha',buscar:q.buscar||q.q},100),params:Datos={},where=['1=1'];
 if(f.desde||f.hasta){where.push(`EXISTS (SELECT 1 FROM ascendencia a JOIN produccion_lotes rl ON rl.id=a.ascendiente
 JOIN produccion_operaciones ro ON ro.id=rl.id_operacion_origen WHERE a.nodo=v.id AND ro.tipo='DESCARGUIO'
 ${f.desde?'AND ro.fecha >= :desde':''} ${f.hasta?'AND ro.fecha < DATE_ADD(:hasta,INTERVAL 1 DAY)':''})`);
 params.desde=f.desde+' 00:00:00';params.hasta=f.hasta;}
 if(f.modalidad){where.push('v.modalidad IN (:modalidad)');params.modalidad=f.modalidad;}
 if(f.productor){where.push('v.id_productor IN (:productor)');params.productor=f.productor;}
 if(q.propiedad){const propiedades=valoresFiltro(q.propiedad,['PROPIO','TERCERO']);if(propiedades.length===1)where.push(propiedades[0]==='PROPIO'?'v.id_propietario IS NULL':'v.id_propietario IS NOT NULL');}
 const permitidos:Datos={estado:['ACTIVO','AGOTADO','ANULADO'],estado_fisico:['CHALA_HUMEDA','CHALA_SECA','PROCESADO','ENVASADO']};
 for(const k of ['estado','estado_fisico','variedad','clasificacion','ubicacion'])if(q[k]){
  valoresFiltro(q[k],permitidos[k]);
  where.push(`v.${k} IN (:${k})`);params[k]=valoresFiltro(q[k]);
 }
 if(f.buscar){where.push(`(LOCATE(:q,v.codigo)>0 OR LOCATE(:q,v.productor)>0 OR LOCATE(:q,v.producto)>0
 OR EXISTS (SELECT 1 FROM ascendencia a JOIN produccion_lotes rl ON rl.id=a.ascendiente
 JOIN produccion_operaciones ro ON ro.id=rl.id_operacion_origen LEFT JOIN produccion_descarguios d ON d.id_operacion=ro.id
 WHERE a.nodo=v.id AND (LOCATE(:q,ro.codigo)>0 OR LOCATE(:q,rl.codigo)>0 OR LOCATE(:q,d.boleta)>0)))`);params.q=f.buscar;}
 const orden=String(q.orden||'fecha');
 if(!['codigo','boleta','fecha','productor','modalidad','variedad','cantidad_inicial','cantidad_disponible','unidad','ubicacion','estado','estado_fisico','propietario','producto','clasificacion'].includes(orden))throw new ErrorConsultaProduccion('Columna de orden inválida.');
 return {f,params,where:where.join(' AND '),orden};
}
export async function filasLotes(q:Datos,todas=false,t?:Transaction){const c=consulta(q);return leerDesc(`${proyeccion} SELECT v.* FROM vista v WHERE ${c.where}
 ORDER BY v.${c.orden} ${c.f.direccion},v.id ${c.f.direccion} ${todas?'':'LIMIT :limit OFFSET :offset'}`,{...c.params,limit:c.f.limit,offset:c.f.offset},t);}
export async function consultarLotes(q:Datos,t?:Transaction){
 const c=consulta(q),[n]=await leerDesc(`${proyeccion} SELECT COUNT(*) total FROM vista v WHERE ${c.where}`,c.params,t);
 const saldos=await leerDesc(`${proyeccion} SELECT v.unidad,v.estado_fisico,IF(v.id_propietario IS NULL,'Propio','Tercero') propiedad,SUM(v.cantidad_disponible) cantidad
 FROM vista v WHERE ${c.where} AND v.estado='ACTIVO' AND v.estado_documento='CONFIRMADO'
 GROUP BY v.unidad,v.estado_fisico,propiedad`,c.params,t);
 return {items:await filasLotes(q,false,t),total:Number(n.total),resumen:{saldos},alcance:'Saldos actuales de lotes cuyas recepciones coinciden con el período. No es un saldo histórico.'};
}
export async function opcionesLotes(t?:Transaction){return {
 secadoras:await leerDesc("SELECT DISTINCT secadora nombre FROM produccion_secados WHERE secadora IS NOT NULL AND secadora<>'' ORDER BY secadora",{},t),
 presentaciones:await leerDesc("SELECT DISTINCT presentacion nombre FROM produccion_envasados WHERE presentacion IS NOT NULL AND presentacion<>'' ORDER BY presentacion",{},t),
 productos:await leerDesc('SELECT id,nombre FROM productos WHERE eliminado=0 ORDER BY nombre,id',{},t),
 productores:await leerDesc('SELECT id,nombre FROM proveedores WHERE activo=1 ORDER BY nombre,id',{},t),
 variedades:await leerDesc('SELECT DISTINCT variedad nombre FROM produccion_lotes WHERE variedad IS NOT NULL ORDER BY variedad',{},t),
 ubicaciones:await leerDesc("SELECT DISTINCT COALESCE(u.nombre,'Sin ubicación') nombre FROM produccion_lotes l LEFT JOIN produccion_ubicaciones u ON u.id=l.id_ubicacion ORDER BY nombre",{},t),
 clasificaciones:await leerDesc('SELECT DISTINCT clasificacion nombre FROM produccion_procesado_detalles WHERE clasificacion IS NOT NULL ORDER BY clasificacion',{},t)
};}
export async function detalleLote(id:unknown,t?:Transaction){
 const n=Number(id);if(!Number.isSafeInteger(n)||n<=0)throw new ErrorConsultaProduccion('Lote inválido.');
 const [lote]=await leerDesc(`${proyeccion} SELECT * FROM vista WHERE id = :id`,{id:n},t);
 if(!lote)throw new ErrorConsultaProduccion('No se encontró el lote.',404);
 // Ancestros y descendientes del lote seleccionado. Las otras entradas de una unión se muestran como vínculos.
 const relacionados=await leerDesc(`${ancestros} SELECT DISTINCT l.* FROM produccion_lotes l WHERE l.id IN
 (SELECT ascendiente FROM ascendencia WHERE nodo = :id UNION SELECT nodo FROM ascendencia WHERE ascendiente = :id)`,{id:n},t);
 const ids=relacionados.map(l=>Number(l.id));
 const operaciones=await leerDesc(`SELECT DISTINCT o.*,p.nombre productor,COALESCE(prop.nombre,'Ingenio (propio)') propietario,
 CASE o.tipo WHEN 'DESCARGUIO' THEN 'descarguios' WHEN 'SECADO' THEN 'secados' WHEN 'GUARDADO' THEN 'guardados' WHEN 'PROCESADO' THEN 'procesados' ELSE 'envasados' END ruta
 FROM produccion_operaciones o LEFT JOIN proveedores p ON p.id=o.id_productor LEFT JOIN proveedores prop ON prop.id=o.id_propietario
 WHERE o.id IN (SELECT id_operacion_origen FROM produccion_lotes WHERE id IN (:ids))
 OR o.id IN (SELECT id_operacion FROM produccion_etapa_origenes WHERE id_lote IN (:ids)) ORDER BY o.fecha,o.id`,{ids},t);
 const opids=operaciones.map(o=>o.id);
 const entradas=await leerDesc(`SELECT e.id_operacion,e.cantidad,l.id,l.codigo,l.unidad,l.id_propietario,l.variedad FROM produccion_etapa_origenes e JOIN produccion_lotes l ON l.id=e.id_lote WHERE e.id_operacion IN (:ids) ORDER BY e.id`,{ids:opids},t);
 const salidas=await leerDesc('SELECT l.*,p.nombre producto FROM produccion_lotes l LEFT JOIN productos p ON p.id=l.id_producto WHERE l.id_operacion_origen IN (:ids) ORDER BY l.id',{ids:opids},t);
 for(const o of operaciones){o.entradas=entradas.filter(e=>Number(e.id_operacion)===Number(o.id));o.resultados=salidas.filter(l=>Number(l.id_operacion_origen)===Number(o.id));}
 const movimientos=await leerDesc(`SELECT m.*,l.codigo lote,o.codigo documento FROM produccion_movimientos m JOIN produccion_lotes l ON l.id=m.id_lote JOIN produccion_operaciones o ON o.id=m.id_operacion WHERE m.id_lote IN (:ids) ORDER BY m.fecha,m.id`,{ids},t);
 const [conciliacion]=lote.id_propietario==null?await leerDesc(`SELECT p.stock stock_general,
 (SELECT COALESCE(SUM(l.cantidad_disponible),0) FROM produccion_lotes l WHERE l.id_producto=p.id AND l.id_propietario IS NULL AND l.estado='ACTIVO') saldo_lotes
 FROM productos p WHERE p.id = :id`,{id:lote.id_producto},t):[];
 return {lote,operaciones,movimientos,relacionados,conciliacion:conciliacion||null,
 aviso_salidas:'Las salidas entre etapas están identificadas por lote. Los despachos comerciales actuales no registran el lote de origen: no se atribuyen ventas automáticamente. El saldo por lote puede requerir conciliación con el stock general.'};
}
export async function existenciasProductor(q:Datos,todas=false,t?:Transaction){
 const c=consulta(q),sql=`FROM vista v WHERE ${c.where} AND v.estado='ACTIVO' AND v.estado_documento='CONFIRMADO'`,grupo='v.id_propietario,v.id_productor,v.modalidad,v.variedad,v.clasificacion,v.id_producto,v.id_ubicacion,v.ubicacion_detalle,v.unidad,v.estado_fisico';
 const base=`SELECT v.id_propietario,v.id_productor,MAX(v.propietario) propietario,MAX(v.productor) productor,v.modalidad,v.variedad,v.clasificacion,MAX(v.producto) producto,MAX(v.ubicacion) ubicacion,v.ubicacion_detalle,v.unidad,v.estado_fisico,COUNT(*) lotes,SUM(v.cantidad_disponible) cantidad ${sql} GROUP BY ${grupo}`;
 const [n]=await leerDesc(`${proyeccion} SELECT COUNT(*) total FROM (${base}) grupos`,c.params,t);
 const columnas:Datos={fecha:'propietario',codigo:'propietario',cantidad_disponible:'cantidad',cantidad_inicial:'cantidad',estado:'estado_fisico'};
 const orden=columnas[c.orden]||c.orden;
 const items=await leerDesc(`${proyeccion} ${base} ORDER BY ${orden} ${c.f.direccion},propietario,variedad,producto,ubicacion,unidad ${todas?'':'LIMIT :limit OFFSET :offset'}`,{...c.params,limit:c.f.limit,offset:c.f.offset},t);
 const saldos=await leerDesc(`${proyeccion} SELECT v.unidad,IF(v.id_propietario IS NULL,'Propio','Tercero') propiedad,SUM(v.cantidad_disponible) cantidad ${sql} GROUP BY v.unidad,propiedad`,c.params,t);
 return {items,total:Number(n.total),resumen:{saldos}};
}
export const numeroProduccion=(n:any)=>n==null?'No medido':new Intl.NumberFormat('es-BO',{maximumFractionDigits:3}).format(Number(n));
export async function filtrosLotes(q:Datos,t?:Transaction){
 const items=[{label:'Recepciones desde',valor:q.fecha_desde||'Sin límite'},{label:'Hasta',valor:q.fecha_hasta||'Sin límite'}];
 if(q.id_productor){const productores=await leerDesc('SELECT nombre FROM proveedores WHERE id IN (:id)',{id:idsFiltro(q.id_productor)},t); const p={nombre:productores.map(p=>p.nombre).join(', ')};items.push({label:'Productor',valor:p?.nombre||'No encontrado'});}
 for(const [k,label] of Object.entries({modalidad:'Modalidad',propiedad:'Propiedad',variedad:'Variedad',estado:'Estado',estado_fisico:'Etapa física',ubicacion:'Ubicación',clasificacion:'Clasificación',buscar:'Búsqueda',q:'Búsqueda'}))if(q[k])items.push({label,valor:String(q[k])});
 items.push({label:'Alcance',valor:'Saldos actuales; período aplicado a la recepción de origen. Salidas comerciales sin asignación de lote no incluidas.'});return items;
}
export async function hojaLotes(q:Datos,formato:'pdf'|'xlsx',existencias=false,t?:Transaction):Promise<HojaExport>{
 const datos=existencias?await existenciasProductor(q,true,t):await consultarLotes({...q,limit:1},t),rows=existencias?datos.items:await filasLotes(q,true,t),n=(v:any)=>formato==='xlsx'?Number(v):numeroProduccion(v);
 const columnas=existencias?['Propietario','Productor','Modalidad','Variedad','Clasificación','Producto','Ubicación','Etapa física','Cantidad','Unidad']:['Lote','Recepción','Boleta','Productor','Propietario','Variedad','Producto','Inicial','Disponible','Unidad','Ubicación','Estado'];
 const h=aplicarPlantillaFormal({nombre:existencias?'Existencias por productor':'Lotes',titulo:existencias?'EXISTENCIAS POR PRODUCTOR':'LOTES Y TRAZABILIDAD',orientacion:'landscape',textoCompleto:true,mostrarTotalesAutomaticos:false,
 columnas,filas:rows.map(r=>existencias?[r.propietario,r.productor||'No informado',r.modalidad,r.variedad,r.clasificacion,r.producto,[r.ubicacion,r.ubicacion_detalle].filter(Boolean).join(' / '),r.estado_fisico,n(r.cantidad),r.unidad]:
 [r.codigo,r.fecha?new Date(r.fecha).toLocaleDateString('es-BO',{timeZone:'America/La_Paz'}):'—',r.boleta||'—',r.productor||'No informado',r.propietario,r.variedad,r.producto,n(r.cantidad_inicial),n(r.cantidad_disponible),r.unidad,[r.ubicacion,r.ubicacion_detalle].filter(Boolean).join(' / '),r.estado]),
 proporcionesColumnas:existencias?{'N°':20,Propietario:100,Productor:100,Modalidad:50,Variedad:45,Clasificación:62,Producto:85,Ubicación:70,'Etapa física':70,Cantidad:50,Unidad:42}:undefined,
 formatosNumericos:{Cantidad:'#,##0.###',Inicial:'#,##0.###',Disponible:'#,##0.###'},resumen:[{label:'Registros',valor:rows.length},...datos.resumen.saldos.map((s:any)=>({label:[s.propiedad,s.estado_fisico,s.unidad].filter(Boolean).join(' / '),valor:numeroProduccion(s.cantidad)}))]},await filtrosLotes(q,t));
 h.mostrarFirma=false;return h;
}
