import { Transaction } from 'sequelize';
import { aplicarPlantillaFormal, HojaExport } from '../utils/exportar';
import { consultaDescarguios, filasDescarguios } from './descarguios-consulta.servicio';
import { leerDesc } from './descarguios.servicio';

export async function hojaDescarguios(query: Record<string, unknown>, formato: 'pdf' | 'xlsx', transaction?: Transaction): Promise<HojaExport> {
    const c = consultaDescarguios(query), filas = await filasDescarguios(query, true, transaction);
    const etiquetas: Record<string, string> = { COMPRA: 'Compra', SERVICIO: 'Servicio', BORRADOR: 'Borrador', CONFIRMADO: 'Confirmado', ANULADO: 'Anulado' };
    const fecha = (valor: Date | string) => new Intl.DateTimeFormat('es-BO', { timeZone: 'America/La_Paz' }).format(new Date(valor));
    const numero = (valor: unknown) => new Intl.NumberFormat('es-BO', { maximumFractionDigits: 3 }).format(Number(valor));
    const [productor] = c.productor ? await leerDesc('SELECT nombre FROM productores WHERE id= :id', { id: c.productor }, transaction) : [];
    const filtros = [{ label: 'Desde', valor: c.desde || 'Sin límite' }, { label: 'Hasta', valor: c.hasta || 'Sin límite' },
        { label: 'Modalidad', valor: etiquetas[c.modalidad || ''] || 'Todas' }, { label: 'Estado', valor: etiquetas[c.estado] || 'Todos' },
        { label: 'Variedad', valor: c.variedad || 'Todas' }, { label: 'Productor', valor: productor?.nombre || 'Todos' }, { label: 'Búsqueda', valor: c.buscar || 'Sin búsqueda' }];
    const cantidades = new Map<string, number>();
    for (const f of filas) if (f.estado === 'CONFIRMADO' && f.cantidad != null && f.unidad) {
        const clave = `${etiquetas[f.modalidad]} / ${f.unidad}`;
        cantidades.set(clave, (cantidades.get(clave) || 0) + Math.round(Number(f.cantidad) * 1000));
    }
    return aplicarPlantillaFormal({ nombre: 'Descarguíos', titulo: 'CONTROL DE DESCARGUÍOS', textoCompleto: true,
        orientacion: 'landscape', formatosNumericos: { Cantidad: '#,##0.###' }, mostrarTotalesAutomaticos: false,
        resumen: [{ label: 'Registros', valor: filas.length }, { label: 'Confirmados', valor: filas.filter(f => f.estado === 'CONFIRMADO').length },
            ...[...cantidades].map(([label, valor]) => ({ label, valor: numero(valor / 1000) }))],
        proporcionesColumnas: { 'Código': 38, Fecha: 42, Boleta: 48, Placa: 42, Chofer: 78, Productor: 86, Origen: 65,
            Variedad: 45, Cantidad: 42, Unidad: 36, 'Peso real (kg)': 48, Silo: 48, 'H. entrada (%)': 42,
            'Imp. entrada (%)': 42, 'Imp. salida (%)': 42, Observaciones: 80, Estado: 42 },
        columnas: ['Código', 'Fecha', 'Boleta', 'Placa', 'Chofer', 'Productor', 'Origen', 'Variedad', 'Cantidad', 'Unidad',
            'Peso real (kg)', 'Silo', 'H. entrada (%)', 'Imp. entrada (%)', 'Imp. salida (%)', 'Observaciones', 'Estado'],
        filas: filas.map(f => [f.codigo, fecha(f.fecha), f.boleta || 'No informada', f.placa || 'No informada', f.chofer || 'No informado',
            f.productor || 'No informado', f.procedencia || 'No informada', f.variedad || 'No informada',
            f.cantidad == null ? 'No informada' : formato === 'pdf' ? numero(f.cantidad) : Number(f.cantidad), f.unidad || 'No informada',
            f.peso_real_kg == null ? 'No medido' : formato === 'pdf' ? numero(f.peso_real_kg) : Number(f.peso_real_kg),
            f.ubicacion || 'No informada', f.humedad_entrada == null ? 'No medida' : numero(f.humedad_entrada),
            f.impurezas_entrada == null ? 'No medida' : numero(f.impurezas_entrada), f.impurezas_salida == null ? 'No medida' : numero(f.impurezas_salida),
            f.observacion || '—', etiquetas[f.estado]])
    }, filtros);
}
