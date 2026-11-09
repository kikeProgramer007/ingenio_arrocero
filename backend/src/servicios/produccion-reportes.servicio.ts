import { Transaction } from 'sequelize';
import { hojaDescarguios } from './descarguios-reporte.servicio';
import { hojaEtapa, listarEtapa, filasEtapa } from './produccion-etapas-consulta.servicio';
import { hojaTransformacion, filasTransformacion, listarTransformacion } from './produccion-transformaciones-consulta.servicio';
import { filasDescarguios, listadoDescarguios } from './descarguios-consulta.servicio';
import { numeroProduccion } from './produccion-trazabilidad.servicio';
import { aplicarPlantillaFormal, HojaExport } from '../utils/exportar';
import { filtrosProduccion, ErrorConsultaProduccion } from './produccion-consulta.servicio';

export const MODULOS_CONSOLIDADO = ['descarguios', 'secados', 'guardados', 'procesados', 'envasados'] as const;
export type ModuloConsolidado = (typeof MODULOS_CONSOLIDADO)[number];

export const reportesProduccion: Record<string, { nombre: string; programa: string }> = {
    consolidado: { nombre: 'Consolidado de producción', programa: 'consolidado' },
    descarguios: { nombre: 'Control de descarguíos', programa: 'descarguios' },
    secados: { nombre: 'Control de secados', programa: 'secados' },
    guardados: { nombre: 'Control de guardados', programa: 'guardados' },
    procesados: { nombre: 'Control de procesados', programa: 'procesados' },
    envasados: { nombre: 'Control de envasados', programa: 'envasados' },
    rendimiento: { nombre: 'Rendimiento de producción', programa: 'procesados' }
};

const etiquetaModulo: Record<string, string> = {
    descarguios: 'Descarguío',
    secados: 'Secado',
    guardados: 'Guardado',
    procesados: 'Procesado',
    envasados: 'Envasado'
};

function fechaLaPaz(v: any) {
    return new Date(v).toLocaleDateString('es-BO', { timeZone: 'America/La_Paz' });
}

export function normalizarModulosConsolidado(raw: unknown): ModuloConsolidado[] {
    const pedidos = String(raw ?? '')
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);
    const base = pedidos.length ? pedidos : [...MODULOS_CONSOLIDADO];
    return MODULOS_CONSOLIDADO.filter(m => base.includes(m));
}

export async function hojaReporteProduccion(tipo: string, q: Record<string, any>, formato: 'pdf' | 'xlsx', t?: Transaction, todas = true): Promise<HojaExport> {
    if (!reportesProduccion[tipo] || tipo === 'consolidado') throw new ErrorConsultaProduccion('Reporte de producción inválido.', 404);
    const fmt = formato === 'pdf' ? 'pdf' : 'xlsx';
    const query = todas
        ? { ...q, orden: 'fecha', direccion: -1, offset: 0, limit: 10 }
        : { ...q, orden: q.orden || 'fecha', direccion: q.direccion ?? -1, offset: q.offset ?? 0, limit: q.limit ?? 10 };
    let h: HojaExport;
    if (tipo === 'descarguios') h = await hojaDescarguios(query, fmt, t, todas);
    else if (tipo === 'secados' || tipo === 'guardados') h = await hojaEtapa(tipo === 'secados' ? 'SECADO' : 'GUARDADO', query, fmt, t, todas);
    else if (tipo === 'procesados' || tipo === 'envasados') h = await hojaTransformacion(tipo === 'procesados' ? 'PROCESADO' : 'ENVASADO', query, fmt, t, todas);
    else {
        const rows = await filasTransformacion('PROCESADO', query, todas, t),
            summary = await listarTransformacion('PROCESADO', { ...query, limit: 1 }, t);
        const base = await hojaTransformacion('PROCESADO', { ...query, limit: 1 }, formato, t, false),
            n = (v: any) => (v == null ? 'No medido' : Number(v));
        h = aplicarPlantillaFormal(
            {
                nombre: 'Rendimiento',
                titulo: 'RENDIMIENTO DE PRODUCCIÓN',
                orientacion: 'portrait',
                textoCompleto: true,
                mostrarTotalesAutomaticos: false,
                proporcionesColumnas: { 'N°': 20, Proceso: 72, Fecha: 52, Productor: 145, Variedad: 43, 'Entrada medida (kg)': 62, 'Salida medida (kg)': 62, 'Rendimiento (%)': 60, Estado: 66 },
                columnas: ['Proceso', 'Fecha', 'Productor', 'Variedad', 'Entrada medida (kg)', 'Salida medida (kg)', 'Rendimiento (%)', 'Estado'],
                filas: rows.map(r => [
                    r.codigo,
                    new Date(r.fecha).toLocaleDateString('es-BO', { timeZone: 'America/La_Paz' }),
                    r.productor || 'No informado',
                    r.variedad || 'No informada',
                    n(r.unidad === 'Kilo' ? r.cantidad : r.peso_entrada_kg),
                    n(r.peso_salida_kg),
                    n(r.resumen.rendimiento),
                    r.estado
                ]),
                resumen: [
                    { label: 'Operaciones', valor: Number(summary.total) },
                    { label: 'Rendimiento ponderado (%)', valor: numeroProduccion(summary.resumen.rendimiento) }
                ],
                formatosNumericos: { 'Entrada medida (kg)': '#,##0.###', 'Salida medida (kg)': '#,##0.###', 'Rendimiento (%)': '0.###' }
            },
            base.consulta
        );
        h.consulta!.push({
            label: 'Cálculo',
            valor: 'Salida medida / entrada medida × 100. Sin equivalencias implícitas. El ponderado incluye confirmados y exige mediciones completas.'
        });
    }
    const idx = q.columna == null ? 0 : Number(q.columna);
    if (!Number.isSafeInteger(idx) || idx < 0 || idx >= h.columnas.length) throw new ErrorConsultaProduccion('Columna de orden inválida.');
    const comparable = (v: any) =>
        typeof v === 'number'
            ? v
            : typeof v === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v)
              ? v
                    .split('/')
                    .reverse()
                    .map((s: string) => s.padStart(2, '0'))
                    .join('-')
              : String(v ?? '');
    const sign = String(q.direccion) === '1' ? 1 : -1;
    h.filas.sort((a, b) => {
        const x = comparable(a[idx]),
            y = comparable(b[idx]);
        return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'es', { numeric: true })) * sign;
    });
    if (formato === 'pdf') h.filas = h.filas.map(row => row.map((v, j) => (typeof v === 'number' && j !== 0 ? numeroProduccion(v) : v)));
    h.mostrarFirma = false;
    h.cabeceraReporte = true;
    return h;
}

export async function hojasConsolidado(q: Record<string, any>, formato: 'pdf' | 'xlsx', tipos: string[], t?: Transaction): Promise<HojaExport[]> {
    const hojas: HojaExport[] = [];
    for (const tipo of tipos) {
        if (!MODULOS_CONSOLIDADO.includes(tipo as ModuloConsolidado)) continue;
        const h = await hojaReporteProduccion(tipo, q, formato, t);
        h.nombre = etiquetaModulo[tipo] || tipo;
        hojas.push(h);
    }
    if (!hojas.length) throw new ErrorConsultaProduccion('No hay módulos de producción para consolidar.', 400);
    return hojas;
}

const MAX_CONSOLIDADO_PANTALLA = 1500;

async function metaModulo(tipo: string, q: Record<string, any>, t?: Transaction): Promise<{ total: number; confirmados?: number }> {
    if (tipo === 'descarguios') {
        const d = await listadoDescarguios({ ...q, limit: 1, offset: 0 }, t);
        return { total: d.total, confirmados: d.resumen.confirmados };
    }
    if (tipo === 'secados' || tipo === 'guardados') {
        const d = await listarEtapa(tipo === 'secados' ? 'SECADO' : 'GUARDADO', { ...q, limit: 1, offset: 0 }, t);
        const meta = d.resumen as { confirmados?: number };
        return { total: d.total, confirmados: Number(meta.confirmados ?? 0) };
    }
    const d = await listarTransformacion(tipo === 'procesados' ? 'PROCESADO' : 'ENVASADO', { ...q, limit: 1, offset: 0 }, t);
    const meta = d.resumen as { confirmados?: number };
    return { total: d.total, confirmados: Number(meta.confirmados ?? 0) };
}

export async function consultarConsolidado(q: Record<string, any>, tipos: string[], t?: Transaction) {
    const f = filtrosProduccion({ ...q, tipo: undefined, orden: 'fecha' }, 100);
    const queryBase = { ...q, orden: 'fecha', direccion: q.direccion ?? -1, offset: 0 };
    const validos = tipos.filter(tipo => MODULOS_CONSOLIDADO.includes(tipo as ModuloConsolidado));
    // Buffer mínimo 100 para poder ordenar/paginar el merge entre módulos en pantalla.
    const tope = Math.min(MAX_CONSOLIDADO_PANTALLA, Math.max(f.offset + f.limit, 100));
    const bloques = await Promise.all(
        validos.map(async tipo => {
            const labelResumen =
                tipo === 'descarguios' ? 'Descarguíos' : tipo === 'secados' ? 'Secados' : tipo === 'guardados' ? 'Guardados' : tipo === 'procesados' ? 'Procesados' : 'Envasados';
            const [meta, rows] = await Promise.all([
                metaModulo(tipo, queryBase, t),
                tipo === 'descarguios'
                    ? filasDescarguios({ ...queryBase, limit: tope, offset: 0 }, false, t)
                    : tipo === 'secados' || tipo === 'guardados'
                      ? filasEtapa(tipo === 'secados' ? 'SECADO' : 'GUARDADO', { ...queryBase, limit: tope, offset: 0 }, false, t)
                      : filasTransformacion(tipo === 'procesados' ? 'PROCESADO' : 'ENVASADO', { ...queryBase, limit: tope, offset: 0 }, false, t)
            ]);
            return { tipo, labelResumen, meta, rows };
        })
    );
    const resumen = bloques.map(b => ({ label: b.labelResumen, valor: String(b.meta.total) }));
    const items: { id: number; valores: any[] }[] = [];
    let id = 1;
    for (const b of bloques) {
        for (const r of b.rows) {
            items.push({
                id: id++,
                valores: [
                    etiquetaModulo[b.tipo],
                    r.codigo,
                    fechaLaPaz(r.fecha),
                    r.productor || (r.modalidad === 'COMPRA' ? 'Ingenio (propio)' : '—'),
                    r.variedad || r.producto || '—',
                    r.cantidad != null ? Number(r.cantidad) : r.cantidad_destino != null ? Number(r.cantidad_destino) : null,
                    r.unidad || r.unidad_destino || '—',
                    r.estado
                ]
            });
        }
    }
    const sign = String(q.direccion) === '1' ? 1 : -1;
    const idx = q.columna == null ? 2 : Number(q.columna);
    const comparable = (v: any) =>
        typeof v === 'number'
            ? v
            : typeof v === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v)
              ? v
                    .split('/')
                    .reverse()
                    .map((s: string) => s.padStart(2, '0'))
                    .join('-')
              : String(v ?? '');
    items.sort((a, b) => {
        const x = comparable(a.valores[idx] ?? a.valores[2]),
            y = comparable(b.valores[idx] ?? b.valores[2]);
        return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'es', { numeric: true })) * sign;
    });
    const totalReal = bloques.reduce((n, b) => n + b.meta.total, 0);
    return {
        columnas: ['Módulo', 'Código', 'Fecha', 'Productor', 'Variedad', 'Cantidad', 'Unidad', 'Estado'],
        items: items.slice(f.offset, f.offset + f.limit),
        total: totalReal,
        resumen,
        consulta: totalReal > items.length ? [{ label: 'Nota', valor: `Vista limitada a ${items.length} filas para agilizar; use PDF/Excel para el detalle completo.` }] : []
    };
}

function resumenDesdeListado(tipo: string, total: number, resumen: any): { label: string; valor: string | number }[] {
    const cards: { label: string; valor: string | number }[] = [
        { label: tipo === 'rendimiento' ? 'Operaciones' : 'Registros', valor: total },
        { label: 'Confirmados', valor: Number(resumen?.confirmados ?? 0) }
    ];
    if (Array.isArray(resumen?.cantidades)) {
        const etiquetas: Record<string, string> = { COMPRA: 'Compra', SERVICIO: 'Servicio' };
        const conf = resumen.cantidades.filter((c: any) => c.estado === 'CONFIRMADO' || !c.estado);
        for (const c of conf) {
            if (c.cantidad == null || !c.unidad) continue;
            const label = `${etiquetas[c.modalidad] || c.modalidad || 'Total'} / ${c.unidad}`;
            cards.push({ label, valor: new Intl.NumberFormat('es-BO', { maximumFractionDigits: 3 }).format(Number(c.cantidad)) });
        }
    }
    if (tipo === 'rendimiento' && resumen?.rendimiento != null) {
        cards.push({ label: 'Rendimiento ponderado (%)', valor: numeroProduccion(resumen.rendimiento) });
    }
    return cards;
}

// Pantalla pagina en SQL; export (PDF/Excel) sigue usando el juego completo.
export async function consultarReporteProduccion(tipo: string, q: Record<string, any>, t?: Transaction) {
    if (tipo === 'consolidado') {
        const tipos = normalizarModulosConsolidado(q.modulos);
        if (!tipos.length) throw new ErrorConsultaProduccion('Seleccione al menos un módulo para el consolidado.', 400);
        return consultarConsolidado(q, tipos, t);
    }
    const f = filtrosProduccion({ ...q, tipo: undefined, orden: 'fecha' }, 100);
    const pageQ = { ...q, limit: f.limit, offset: f.offset, orden: q.orden || 'fecha', direccion: q.direccion ?? -1 };
    const h = await hojaReporteProduccion(tipo, pageQ, 'xlsx', t, false);
    let total = h.filas.length;
    let resumen = h.resumen || [];
    if (tipo === 'descarguios') {
        const d = await listadoDescarguios({ ...pageQ, limit: 1, offset: 0 }, t);
        total = d.total;
        resumen = resumenDesdeListado(tipo, d.total, d.resumen);
    } else if (tipo === 'secados' || tipo === 'guardados') {
        const d = await listarEtapa(tipo === 'secados' ? 'SECADO' : 'GUARDADO', { ...pageQ, limit: 1, offset: 0 }, t);
        total = d.total;
        resumen = resumenDesdeListado(tipo, d.total, d.resumen);
    } else if (tipo === 'procesados' || tipo === 'envasados' || tipo === 'rendimiento') {
        const d = await listarTransformacion('PROCESADO', { ...pageQ, limit: 1, offset: 0 }, t);
        if (tipo === 'envasados') {
            const e = await listarTransformacion('ENVASADO', { ...pageQ, limit: 1, offset: 0 }, t);
            total = e.total;
            resumen = resumenDesdeListado(tipo, e.total, e.resumen);
        } else {
            total = d.total;
            resumen = tipo === 'rendimiento' ? (h.resumen || resumenDesdeListado(tipo, d.total, d.resumen)) : resumenDesdeListado(tipo, d.total, d.resumen);
        }
    }
    const rows = h.filas.map((valores, i) => ({ id: f.offset + i + 1, valores }));
    return { columnas: h.columnas, items: rows, total, resumen, consulta: h.consulta || [] };
}
