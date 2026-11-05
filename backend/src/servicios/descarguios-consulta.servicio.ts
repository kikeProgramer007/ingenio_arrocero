import { Transaction } from 'sequelize';
import { filtrosProduccion } from './produccion-consulta.servicio';
import { ErrorDescarguio } from '../dtos/descarguio.dto';
import { leerDesc } from './descarguios.servicio';

export function consultaDescarguios(query: Record<string, unknown>) {
    const f = filtrosProduccion({ ...query, tipo: undefined, orden: 'fecha', buscar: query.buscar || query.q });
    const estado = query.estado ? String(query.estado) : '';
    const variedad = query.variedad ? String(query.variedad).trim() : '';
    if (estado && !['BORRADOR', 'CONFIRMADO', 'ANULADO'].includes(estado)) throw new ErrorDescarguio('Estado de descarguío inválido.');
    if (variedad.length > 100) throw new ErrorDescarguio('Variedad demasiado extensa.');
    const ordenes: Record<string, string> = { codigo: 'o.codigo', fecha: 'o.fecha', boleta: 'd.boleta', productor: 'p.nombre', modalidad: 'o.modalidad',
        variedad: 'd.variedad', cantidad: 'd.cantidad', unidad: 'd.unidad', humedad_entrada: 'd.humedad_entrada', ubicacion: 'ubicacion', estado: 'o.estado' };
    const orden = String(query.orden || 'fecha');
    if (!ordenes[orden]) throw new ErrorDescarguio('Columna de orden inválida.');
    const where = ["o.tipo='DESCARGUIO'"];
    const params: Record<string, any> = {};
    if (f.desde) { where.push('o.fecha>= :desde'); params.desde = `${f.desde} 00:00:00`; }
    if (f.hasta) { where.push('o.fecha<DATE_ADD(:hasta,INTERVAL 1 DAY)'); params.hasta = f.hasta; }
    if (f.productor) { where.push('o.id_productor= :productor'); params.productor = f.productor; }
    if (f.modalidad) { where.push('o.modalidad= :modalidad'); params.modalidad = f.modalidad; }
    if (estado) { where.push('o.estado= :estado'); params.estado = estado; }
    if (variedad) { where.push('d.variedad= :variedad'); params.variedad = variedad; }
    if (f.buscar) { where.push('(LOCATE(:q,o.codigo)>0 OR LOCATE(:q,d.boleta)>0 OR LOCATE(:q,p.nombre)>0)'); params.q = f.buscar; }
    return { ...f, estado, variedad, sql: where.join(' AND '), params, campoOrden: ordenes[orden] };
}
const uniones = `FROM produccion_operaciones o JOIN produccion_descarguios d ON d.id_operacion=o.id
    LEFT JOIN productores p ON p.id=o.id_productor LEFT JOIN produccion_ubicaciones u ON u.id=d.id_ubicacion`;
export async function filasDescarguios(query: Record<string, unknown>, todas = false, t?: Transaction) {
    const c = consultaDescarguios(query);
    return leerDesc(`SELECT o.id,o.codigo,o.fecha,o.modalidad,o.estado,o.version,d.boleta,p.nombre productor,
        d.variedad,d.cantidad,d.unidad,d.humedad_entrada,d.impurezas_entrada,d.impurezas_salida,d.peso_real_kg,
        d.chofer,d.placa,d.procedencia,o.observacion,COALESCE(u.nombre,d.punto_descarga) ubicacion,d.id_lote
        ${uniones} WHERE ${c.sql} ORDER BY ${c.campoOrden} ${c.direccion},o.id ${c.direccion}
        ${todas ? '' : 'LIMIT :limite OFFSET :offset'}`, { ...c.params, limite: c.limit, offset: c.offset }, t);
}
export async function listadoDescarguios(query: Record<string, unknown>, t?: Transaction) {
    const c = consultaDescarguios(query);
    const [conteos] = await leerDesc(`SELECT COUNT(*) total,COALESCE(SUM(o.estado='BORRADOR'),0) borradores,
        COALESCE(SUM(o.estado='CONFIRMADO'),0) confirmados,COALESCE(SUM(o.estado='ANULADO'),0) anulados ${uniones} WHERE ${c.sql}`, c.params, t);
    const cantidades = await leerDesc(`SELECT o.modalidad,o.estado,d.unidad,SUM(d.cantidad) cantidad ${uniones}
        WHERE ${c.sql} AND d.cantidad IS NOT NULL AND d.unidad IS NOT NULL GROUP BY o.modalidad,o.estado,d.unidad ORDER BY o.estado,o.modalidad,d.unidad`, c.params, t);
    return { items: await filasDescarguios(query, false, t), total: Number(conteos.total),
        resumen: { borradores: Number(conteos.borradores), confirmados: Number(conteos.confirmados), anulados: Number(conteos.anulados), cantidades } };
}

export async function opcionesDescarguio(query: Record<string, unknown>, t?: Transaction) {
    const q = String(query.q || '').trim();
    if (q.length > 150) throw new ErrorDescarguio('Búsqueda demasiado extensa.');
    const id = query.id ? Number(query.id) : null;
    if (id != null && (!Number.isSafeInteger(id) || id <= 0)) throw new ErrorDescarguio('Identificador inválido.');
    const params = { q, id };
    switch (query.grupo) {
        case 'productores': return leerDesc(`SELECT id,nombre,nit_ci FROM productores WHERE activo=1 AND
            (:id IS NOT NULL AND id= :id OR :id IS NULL AND (LOCATE(:q,nombre)>0 OR LOCATE(:q,COALESCE(nit_ci,''))>0)) ORDER BY nombre,id LIMIT 50`, params, t);
        case 'productos': return leerDesc(`SELECT p.id,p.nombre,p.unidad_medida,c.nombre categoria FROM productos p
            LEFT JOIN categorias_producto c ON c.id=p.id_categoria WHERE p.eliminado=0 AND
            (:id IS NOT NULL AND p.id= :id OR :id IS NULL AND LOCATE(:q,p.nombre)>0) ORDER BY p.nombre,p.id LIMIT 50`, params, t);
        case 'ubicaciones': return leerDesc(`SELECT id,nombre,tipo FROM produccion_ubicaciones WHERE activo=1 AND
            (:id IS NOT NULL AND id= :id OR :id IS NULL AND LOCATE(:q,nombre)>0) ORDER BY nombre,id LIMIT 50`, params, t);
        case 'campanas': return leerDesc(`SELECT id,nombre,estado FROM campanas WHERE
            (:id IS NOT NULL AND id= :id OR :id IS NULL AND LOCATE(:q,nombre)>0) ORDER BY fecha_inicio DESC,id DESC LIMIT 50`, params, t);
        case 'variedades': return leerDesc(`SELECT DISTINCT variedad nombre FROM produccion_descarguios WHERE variedad IS NOT NULL
            AND variedad<>'' AND LOCATE(:q,variedad)>0 ORDER BY variedad LIMIT 50`, params, t);
        case 'compras': return leerDesc(`SELECT cd.id,cd.id_compra,cd.id_producto,cd.unidad,cd.descripcion,cd.cantidad_recibida,c.fecha,c.boleta,c.chofer,c.placa,c.id_productor,
            p.nombre productor,pr.nombre producto,pr.unidad_medida,
            GREATEST(0,cd.cantidad_recibida-COALESCE((SELECT SUM(d.cantidad) FROM produccion_descarguios d
                JOIN produccion_operaciones o ON o.id=d.id_operacion WHERE d.id_compra_detalle=cd.id AND o.estado='CONFIRMADO'),0)) disponible
            FROM compra_detalles cd JOIN compras c ON c.id=cd.id_compra JOIN productos pr ON pr.id=cd.id_producto
            LEFT JOIN productores p ON p.id=c.id_productor WHERE c.estado<>'ANULADA' AND pr.eliminado=0
            AND (c.tipo_compra='CHALA' OR (c.tipo_compra IS NULL AND (c.fanegas>0 OR NULLIF(c.boleta,'') IS NOT NULL)))
            AND (:id IS NOT NULL AND cd.id= :id OR :id IS NULL AND (LOCATE(:q,CAST(c.id AS CHAR))>0 OR LOCATE(:q,c.boleta)>0 OR LOCATE(:q,p.nombre)>0 OR LOCATE(:q,pr.nombre)>0))
            ORDER BY c.fecha DESC,cd.id DESC LIMIT 50`, params, t);
        default: throw new ErrorDescarguio('Catálogo no válido.');
    }
}
export async function recepcionesDescarguio(id: unknown, t?: Transaction) {
    const detalle = Number(id);
    if (!Number.isSafeInteger(detalle) || detalle <= 0) throw new ErrorDescarguio('Línea de compra inválida.');
    return leerDesc(`SELECT r.id,r.fecha,r.cantidad,GREATEST(0,r.cantidad-COALESCE((SELECT SUM(d.cantidad)
        FROM produccion_descarguios d JOIN produccion_operaciones o ON o.id=d.id_operacion WHERE d.id_recepcion_compra=r.id AND o.estado='CONFIRMADO'),0)) disponible
        FROM recepciones_compra r WHERE r.id_detalle= :detalle ORDER BY r.fecha,r.id`, { detalle }, t);
}
