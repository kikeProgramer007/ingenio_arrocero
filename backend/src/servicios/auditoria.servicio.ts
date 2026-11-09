import { QueryTypes } from 'sequelize';
import sequelize from '../db/connection';
import { parseFechaLocal } from '../utils/fecha';

type Fila = Record<string, any>;
type Query = Record<string, unknown>;

const EVENTOS = ['CREAR_BORRADOR', 'EDITAR_BORRADOR', 'CONFIRMAR', 'ANULAR'] as const;
const TIPOS = ['DESCARGUIO', 'SECADO', 'GUARDADO', 'PROCESADO', 'ENVASADO'] as const;

function texto(v: unknown, max = 150): string {
    return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function lista(v: unknown): string[] {
    if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean);
    if (typeof v === 'string') return v.split(',').map(s => s.trim()).filter(Boolean);
    return [];
}

function entero(v: unknown, def: number, min: number, max: number): number {
    const n = Number(v);
    if (!Number.isFinite(n)) return def;
    return Math.min(max, Math.max(min, Math.trunc(n)));
}

async function leer<T extends object = Fila>(sql: string, replacements: Record<string, unknown> = {}): Promise<T[]> {
    return sequelize.query<T>(sql, { replacements, type: QueryTypes.SELECT });
}

function filtros(query: Query) {
    const where: string[] = ['1=1'];
    const params: Record<string, unknown> = {};
    const desde = texto(query.fecha_desde, 10);
    const hasta = texto(query.fecha_hasta, 10);
    if (desde) {
        const d = parseFechaLocal(desde);
        if (Number.isFinite(d.getTime())) {
            where.push('a.fecha >= :fecha_desde');
            params.fecha_desde = d;
        }
    }
    if (hasta) {
        const d = parseFechaLocal(hasta);
        if (Number.isFinite(d.getTime())) {
            d.setHours(23, 59, 59, 999);
            where.push('a.fecha <= :fecha_hasta');
            params.fecha_hasta = d;
        }
    }
    const eventos = lista(query.evento).filter(e => (EVENTOS as readonly string[]).includes(e));
    if (eventos.length) {
        where.push('a.evento IN (:eventos)');
        params.eventos = eventos;
    }
    const tipos = lista(query.tipo).filter(t => (TIPOS as readonly string[]).includes(t));
    if (tipos.length) {
        where.push('o.tipo IN (:tipos)');
        params.tipos = tipos;
    }
    const idUsuario = Number(query.id_usuario);
    if (Number.isSafeInteger(idUsuario) && idUsuario > 0) {
        where.push('a.id_usuario = :id_usuario');
        params.id_usuario = idUsuario;
    }
    const buscar = texto(query.buscar || query.q, 150);
    if (buscar) {
        where.push(`(
            LOCATE(:buscar, COALESCE(o.codigo,'')) > 0
            OR LOCATE(:buscar, COALESCE(l.codigo,'')) > 0
            OR LOCATE(:buscar, COALESCE(NULLIF(u.nombre,''),u.username,'')) > 0
            OR LOCATE(:buscar, COALESCE(a.motivo,'')) > 0
            OR LOCATE(:buscar, COALESCE(a.evento,'')) > 0
        )`);
        params.buscar = buscar;
    }
    return { where: where.join(' AND '), params };
}

export async function listarAuditoria(query: Query) {
    const f = filtros(query);
    const limit = entero(query.limit, 25, 1, 100);
    const offset = entero(query.offset, 0, 0, 100000);
    const orden = String(query.orden || 'fecha');
    const direccion = Number(query.direccion) === 1 ? 'ASC' : 'DESC';
    const orders: Record<string, string> = {
        fecha: 'a.fecha',
        evento: 'a.evento',
        codigo: 'o.codigo',
        tipo: 'o.tipo',
        usuario: 'usuario'
    };
    const orderBy = `${orders[orden] || 'a.fecha'} ${direccion}, a.id DESC`;
    const from = `FROM produccion_auditoria a
        LEFT JOIN produccion_operaciones o ON o.id = a.id_operacion
        LEFT JOIN produccion_lotes l ON l.id = a.id_lote
        LEFT JOIN user u ON u.id = a.id_usuario`;
    const [{ total }] = await leer<{ total: number }>(
        `SELECT COUNT(*) total ${from} WHERE ${f.where}`,
        f.params
    );
    const items = await leer(
        `SELECT a.id, a.evento, a.fecha, a.motivo, a.id_operacion, a.id_lote,
            o.codigo, o.tipo, o.estado estado_documento,
            l.codigo lote_codigo,
            COALESCE(NULLIF(u.nombre,''), u.username) usuario
         ${from}
         WHERE ${f.where}
         ORDER BY ${orderBy}
         LIMIT ${limit} OFFSET ${offset}`,
        f.params
    );
    return {
        total: Number(total) || 0,
        limit,
        offset,
        items,
        filtros: {
            eventos: EVENTOS.map(value => ({ value, label: etiquetaEvento(value) })),
            tipos: TIPOS.map(value => ({ value, label: etiquetaTipo(value) }))
        }
    };
}

export function etiquetaEvento(evento: string): string {
    return ({
        CREAR_BORRADOR: 'Borrador creado',
        EDITAR_BORRADOR: 'Borrador editado',
        CONFIRMAR: 'Confirmado',
        ANULAR: 'Anulado'
    } as Record<string, string>)[evento] || evento;
}

export function etiquetaTipo(tipo: string): string {
    return ({
        DESCARGUIO: 'Descarguío',
        SECADO: 'Secado',
        GUARDADO: 'Guardado',
        PROCESADO: 'Procesado',
        ENVASADO: 'Envasado'
    } as Record<string, string>)[tipo] || tipo || '—';
}

export function rutaDocumento(tipo: string | null | undefined, id: number | null | undefined): string | null {
    if (!tipo || !id) return null;
    const base = ({
        DESCARGUIO: 'descarguios',
        SECADO: 'secados',
        GUARDADO: 'guardados',
        PROCESADO: 'procesados',
        ENVASADO: 'envasados'
    } as Record<string, string>)[tipo];
    return base ? `/produccion/${base}/${id}` : null;
}
