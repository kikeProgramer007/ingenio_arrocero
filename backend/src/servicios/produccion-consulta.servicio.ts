import { valoresFiltro, idsFiltro } from '../utils/filtros-multiples-produccion';
import { QueryTypes } from 'sequelize';
import sequelize from '../db/connection';
import { MODALIDADES_PRODUCCION, TIPOS_PRODUCCION, TipoProduccion } from '../db/produccion-schema';

export class ErrorConsultaProduccion extends Error { constructor(mensaje: string, public status = 400) { super(mensaje); } }
type Consulta = Record<string, unknown>;
export interface FiltrosProduccion {
    desde?: string; hasta?: string; modalidad?: string[]; productor?: number[]; tipo?: TipoProduccion;
    buscar: string; offset: number; limit: number; orden: string; direccion: 'ASC' | 'DESC';
}
function fecha(valor: unknown): string | undefined {
    if (valor == null || valor === '') return undefined;
    const texto = String(valor);
    const d = new Date(`${texto}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto) || !Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== texto)
        throw new ErrorConsultaProduccion('La fecha debe tener un formato válido (AAAA-MM-DD).');
    return texto;
}
function entero(valor: unknown, defecto: number, minimo: number, maximo: number): number {
    if (valor == null || valor === '') return defecto;
    const n = Number(valor);
    if (!Number.isSafeInteger(n) || n < minimo || n > maximo) throw new ErrorConsultaProduccion('Parámetros de consulta inválidos.');
    return n;
}
export function filtrosProduccion(query: Consulta, maxFilas = 50): FiltrosProduccion {
    const desde = fecha(query.fecha_desde), hasta = fecha(query.fecha_hasta);
    if (desde && hasta && desde > hasta) throw new ErrorConsultaProduccion('La fecha inicial no puede ser posterior a la final.');
    const modalidades = valoresFiltro(query.modalidad, MODALIDADES_PRODUCCION); const modalidad = modalidades.length ? modalidades : undefined;
    const tipo = query.tipo ? String(query.tipo) as TipoProduccion : undefined;
    if (tipo && !TIPOS_PRODUCCION.includes(tipo)) throw new ErrorConsultaProduccion('Tipo de operación inválido.');
    const buscar = String(query.buscar || '').trim();
    if (buscar.length > 150) throw new ErrorConsultaProduccion('La búsqueda admite hasta 150 caracteres.');
    const orden = String(query.orden || 'fecha');
    if (!['codigo', 'fecha', 'productor', 'modalidad', 'estado', 'tipo', 'unidad', 'cantidad_disponible', 'etapa'].includes(orden))
        throw new ErrorConsultaProduccion('Columna de orden inválida.');
    return { desde, hasta, modalidad, tipo, buscar, productor: valoresFiltro(query.id_productor).length ? idsFiltro(query.id_productor) : undefined,
        offset: entero(query.offset, 0, 0, 1000000), limit: entero(query.limit, 10, 1, maxFilas), orden,
        direccion: String(query.direccion || '-1') === '1' ? 'ASC' : 'DESC' };
}
function condicion(f: FiltrosProduccion, lote = false) {
    const condiciones = ['1 = 1'];
    const replacements: Record<string, any> = {};
    if (f.desde) { condiciones.push('o.fecha >= :desde'); replacements.desde = `${f.desde} 00:00:00`; }
    if (f.hasta) { condiciones.push('o.fecha < DATE_ADD(:hasta, INTERVAL 1 DAY)'); replacements.hasta = f.hasta; }
    const entidad = lote ? 'l' : 'o';
    if (f.modalidad) { condiciones.push(`${entidad}.modalidad IN (:modalidad)`); replacements.modalidad = f.modalidad; }
    if (f.productor) { condiciones.push(`${entidad}.id_productor IN (:productor)`); replacements.productor = f.productor; }
    if (f.tipo && !lote) { condiciones.push('o.tipo = :tipo'); replacements.tipo = f.tipo; }
    if (f.buscar) {
        condiciones.push(lote
            ? '(LOCATE(:buscar, l.codigo) > 0 OR LOCATE(:buscar, p.nombre) > 0 OR LOCATE(:buscar, pr.nombre) > 0 OR LOCATE(:buscar, l.variedad) > 0)'
            : '(LOCATE(:buscar, o.codigo) > 0 OR LOCATE(:buscar, p.nombre) > 0 OR EXISTS (SELECT 1 FROM produccion_descarguios d WHERE d.id_operacion = o.id AND LOCATE(:buscar, d.boleta) > 0))');
        replacements.buscar = f.buscar;
    }
    return { sql: condiciones.join(' AND '), replacements };
}
async function seleccionar<T extends object = Record<string, any>>(sql: string, replacements: Record<string, any> = {}): Promise<T[]> {
    return sequelize.query<T>(sql, { type: QueryTypes.SELECT, replacements });
}

const unionOperaciones = 'FROM produccion_operaciones o LEFT JOIN proveedores p ON p.id = o.id_productor LEFT JOIN proveedores prop ON prop.id = o.id_propietario';
const unionLotes = `FROM produccion_lotes l JOIN produccion_operaciones o ON o.id = l.id_operacion_origen
    LEFT JOIN proveedores p ON p.id = l.id_productor LEFT JOIN proveedores prop ON prop.id = l.id_propietario
    LEFT JOIN productos pr ON pr.id = l.id_producto LEFT JOIN produccion_ubicaciones u ON u.id = l.id_ubicacion`;

export async function operacionesProduccion(f: FiltrosProduccion) {
    const c = condicion(f);
    const ordenes: Record<string, string> = { codigo: 'o.codigo', fecha: 'o.fecha', productor: 'p.nombre', modalidad: 'o.modalidad', estado: 'o.estado', tipo: 'o.tipo' };
    if (!ordenes[f.orden]) throw new ErrorConsultaProduccion('Columna de orden inválida para operaciones.');
    const [total] = await seleccionar(`SELECT COUNT(*) total ${unionOperaciones} WHERE ${c.sql}`, c.replacements);
    const items = await seleccionar(`SELECT o.id, o.codigo, o.fecha, o.tipo, o.modalidad, o.estado, p.nombre productor,
        CASE WHEN o.modalidad = 'COMPRA' THEN 'Ingenio (propio)' ELSE prop.nombre END propietario
        ${unionOperaciones} WHERE ${c.sql} ORDER BY ${ordenes[f.orden]} ${f.direccion}, o.id ${f.direccion} LIMIT :limite OFFSET :offset`,
        { ...c.replacements, limite: f.limit, offset: f.offset });
    const cantidades = items.length ? await seleccionar(`SELECT id_operacion, rol, unidad, SUM(cantidad) cantidad
        FROM produccion_operacion_lotes WHERE id_operacion IN (:ids) GROUP BY id_operacion, rol, unidad`, { ids: items.map(i => i.id) }) : [];
    return { total: Number(total.total), items: items.map(item => {
        const lineas = cantidades.filter(c => Number(c.id_operacion) === Number(item.id));
        const entrada = lineas.filter(c => c.rol === 'ENTRADA');
        return { ...item, cantidades: (entrada.length ? entrada : lineas.filter(c => c.rol === 'SALIDA')).map(c => ({ unidad: c.unidad, cantidad: Number(c.cantidad) })) };
    }) };
}

export async function lotesProduccion(f: FiltrosProduccion) {
    const c = condicion(f, true);
    const ordenes: Record<string, string> = { codigo: 'l.codigo', fecha: 'o.fecha', productor: 'p.nombre', modalidad: 'l.modalidad', estado: 'l.estado', unidad: 'l.unidad', cantidad_disponible: 'l.cantidad_disponible', etapa: 'l.etapa' };
    if (!ordenes[f.orden]) throw new ErrorConsultaProduccion('Columna de orden inválida para lotes.');
    const [total] = await seleccionar(`SELECT COUNT(*) total ${unionLotes} WHERE ${c.sql}`, c.replacements);
    const items = await seleccionar(`SELECT l.id, l.codigo, o.fecha, l.modalidad, p.nombre productor,
        CASE WHEN l.modalidad = 'COMPRA' THEN 'Ingenio (propio)' ELSE prop.nombre END propietario,
        pr.nombre producto, l.variedad, l.cantidad_inicial, l.cantidad_disponible, l.unidad, l.etapa, l.estado,
        u.nombre ubicacion, l.ubicacion_detalle ${unionLotes} WHERE ${c.sql}
        ORDER BY ${ordenes[f.orden]} ${f.direccion}, l.id ${f.direccion} LIMIT :limite OFFSET :offset`,
        { ...c.replacements, limite: f.limit, offset: f.offset });
    return { total: Number(total.total), items };
}

export async function resumenProduccion(f: FiltrosProduccion) {
    const c = condicion({ ...f, buscar: '', tipo: undefined });
    const l = condicion({ ...f, buscar: '' }, true);
    const [operaciones] = await seleccionar(`SELECT
        COALESCE(SUM(o.tipo = 'PROCESADO' AND o.estado = 'CONFIRMADO'), 0) procesados,
        COALESCE(SUM(o.estado = 'BORRADOR'), 0) pendientes ${unionOperaciones} WHERE ${c.sql}`, c.replacements);
    const [lotes] = await seleccionar(`SELECT
        COALESCE(SUM(l.etapa = 'DESCARGUIO'), 0) descarguios_por_secar,
        COALESCE(SUM(l.etapa = 'SECADO'), 0) secados_por_guardar,
        COALESCE(SUM(l.etapa = 'GUARDADO'), 0) lotes_almacenados ${unionLotes}
        WHERE ${l.sql} AND l.estado = 'ACTIVO' AND l.cantidad_disponible > 0 AND o.estado = 'CONFIRMADO'`, l.replacements);
    const chala = await seleccionar(`SELECT l.modalidad, l.unidad, SUM(l.cantidad_disponible) cantidad ${unionLotes}
        WHERE ${l.sql} AND l.estado = 'ACTIVO' AND l.cantidad_disponible > 0 AND o.estado = 'CONFIRMADO'
        AND l.estado_fisico IN ('CHALA_HUMEDA', 'CHALA_SECA') GROUP BY l.modalidad, l.unidad ORDER BY l.modalidad, l.unidad`, l.replacements);
    return { indicadores: Object.fromEntries(Object.entries({ ...operaciones, ...lotes }).map(([k, v]) => [k, Number(v)])), chala };
}

export async function catalogosProduccion() {
    // Solo productores relacionados con operaciones: no descarga el catálogo comercial completo.
    return { productores: await seleccionar(`SELECT DISTINCT p.id, p.nombre FROM proveedores p
        JOIN produccion_operaciones o ON o.id_productor = p.id ORDER BY p.nombre`) };
}
