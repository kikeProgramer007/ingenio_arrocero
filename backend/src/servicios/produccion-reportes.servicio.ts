import { Transaction } from 'sequelize';
import { hojaDescarguios } from './descarguios-reporte.servicio';
import { hojaEtapa } from './produccion-etapas-consulta.servicio';
import { hojaTransformacion, filasTransformacion, listarTransformacion } from './produccion-transformaciones-consulta.servicio';
import { filasDescarguios } from './descarguios-consulta.servicio';
import { filasEtapa } from './produccion-etapas-consulta.servicio';
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

export async function hojaReporteProduccion(tipo: string, q: Record<string, any>, formato: 'pdf' | 'xlsx', t?: Transaction): Promise<HojaExport> {
    if (!reportesProduccion[tipo] || tipo === 'consolidado') throw new ErrorConsultaProduccion('Reporte de producción inválido.', 404);
    const query = { ...q, orden: 'fecha', direccion: -1, offset: 0, limit: 10 };
    let h: HojaExport;
    if (tipo === 'descarguios') h = await hojaDescarguios(query, 'xlsx', t);
    else if (tipo === 'secados' || tipo === 'guardados') h = await hojaEtapa(tipo === 'secados' ? 'SECADO' : 'GUARDADO', query, 'xlsx', t);
    else if (tipo === 'procesados' || tipo === 'envasados') h = await hojaTransformacion(tipo === 'procesados' ? 'PROCESADO' : 'ENVASADO', query, 'xlsx', t);
    else {
        const rows = await filasTransformacion('PROCESADO', query, true, t),
            summary = await listarTransformacion('PROCESADO', { ...query, limit: 1 }, t);
        const base = await hojaTransformacion('PROCESADO', { ...query, limit: 1 }, formato, t),
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
                    { label: 'Operaciones', valor: rows.length },
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

export async function consultarConsolidado(q: Record<string, any>, tipos: string[], t?: Transaction) {
    const f = filtrosProduccion({ ...q, tipo: undefined, orden: 'fecha' }, 100);
    const query = { ...q, orden: 'fecha', direccion: -1 };
    const items: { id: number; valores: any[] }[] = [];
    const resumen: { label: string; valor: string }[] = [];
    let id = 1;
    for (const tipo of tipos) {
        if (!MODULOS_CONSOLIDADO.includes(tipo as ModuloConsolidado)) continue;
        const rows =
            tipo === 'descarguios'
                ? await filasDescarguios(query, true, t)
                : tipo === 'secados' || tipo === 'guardados'
                  ? await filasEtapa(tipo === 'secados' ? 'SECADO' : 'GUARDADO', query, true, t)
                  : await filasTransformacion(tipo === 'procesados' ? 'PROCESADO' : 'ENVASADO', query, true, t);
        const labelResumen =
            tipo === 'descarguios' ? 'Descarguíos' : tipo === 'secados' ? 'Secados' : tipo === 'guardados' ? 'Guardados' : tipo === 'procesados' ? 'Procesados' : 'Envasados';
        resumen.push({ label: labelResumen, valor: String(rows.length) });
        for (const r of rows) {
            items.push({
                id: id++,
                valores: [
                    etiquetaModulo[tipo],
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
    return {
        columnas: ['Módulo', 'Código', 'Fecha', 'Productor', 'Variedad', 'Cantidad', 'Unidad', 'Estado'],
        items: items.slice(f.offset, f.offset + f.limit),
        total: items.length,
        resumen,
        consulta: []
    };
}

// La pantalla, PDF y Excel consumen exactamente las mismas filas y resúmenes.
export async function consultarReporteProduccion(tipo: string, q: Record<string, any>, t?: Transaction) {
    if (tipo === 'consolidado') {
        const tipos = normalizarModulosConsolidado(q.modulos);
        if (!tipos.length) throw new ErrorConsultaProduccion('Seleccione al menos un módulo para el consolidado.', 400);
        return consultarConsolidado(q, tipos, t);
    }
    const f = filtrosProduccion({ ...q, tipo: undefined, orden: 'fecha' }, 100),
        h = await hojaReporteProduccion(tipo, q, 'xlsx', t),
        rows = h.filas.map((valores, i) => ({ id: i + 1, valores }));
    return { columnas: h.columnas, items: rows.slice(f.offset, f.offset + f.limit), total: rows.length, resumen: h.resumen || [], consulta: h.consulta || [] };
}
