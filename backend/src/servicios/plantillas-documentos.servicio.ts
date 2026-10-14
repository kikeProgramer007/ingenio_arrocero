import path from 'path';
import { EmpresaDatos } from '../utils/empresa';
import { bufferReciboPdf, bufferVoucherPdfConPaginas, DatosReciboMovimiento, DatosVoucher, NOTA_FORMULARIO } from '../utils/pdf-voucher';
import { bufferReportePdf, Celda, HojaExport } from '../utils/exportar';
import { COLUMNAS_DOCUMENTOS } from '../utils/columnas-documentos';

const EMPRESA_PRUEBA: EmpresaDatos = {
    id: 0, nombre: 'EMPRESA DE PRUEBA', nombre_corto: 'EMPRESA DE PRUEBA',
    slogan: 'DOCUMENTO DE PRUEBA', titular: 'TITULAR DE PRUEBA', nit: '0000000000',
    direccion: 'Av. de Prueba 123 - Parque Industrial', telefono: '00000000',
    ciudad: 'CIUDAD DE PRUEBA', email: 'prueba@example.com', path_logo: '',
    formato_nota: '11', tipo_cambio: 6.96
};
const OPCIONES_PRUEBA = { empresa: EMPRESA_PRUEBA, logotipo: path.resolve(__dirname, '../../uploads/defaults/logotipo.jpeg') };
const MARCA_PRUEBA = 'DOCUMENTO DE PRUEBA - SIN VALIDEZ COMERCIAL';
type PdfGenerado = { buffer: Buffer; paginas: number };

function datosNotaVenta(cantidad: number): DatosVoucher {
    const productos = ['ARROZ DE PRUEBA', 'GRANILLO DE PRUEBA', 'KHAJA DE PRUEBA'];
    const precios = [220, 150, 460];
    const lineas = Array.from({ length: cantidad }, (_, i) => {
        const cantidad = (i % 5) + 1;
        const precio = precios[i % precios.length];
        return { codigo: `PRUEBA-${String(i + 1).padStart(3, '0')}`, cantidad,
            descripcion: `${productos[i % productos.length]} ${i + 1}`, precio, importe: cantidad * precio };
    });
    const total = lineas.reduce((suma, linea) => suma + linea.importe, 0);
    return {
        tipoDocumento: 'NOTA DE VENTA', numero: 1, fecha: new Date('2026-01-15T10:30:00-04:00'),
        contraparteLabel: 'CLIENTE', contraparteNombre: 'CLIENTE DE PRUEBA',
        nitCi: '0000000000', codigoContraparte: 'PRUEBA-001',
        direccion: 'Calle de Prueba 456', procedencia: 'LOCALIDAD DE PRUEBA',
        vendedor: 'VENDEDOR DE PRUEBA', tipoPago: 'Credito', plazoDias: 15,
        detalle: 'DOCUMENTO DE PRUEBA - SIN VALIDEZ COMERCIAL', lineas, total,
        cobrado: 0, pendiente: total
    };
}

async function ajustarPaginas(paginas: number, generar: (filas: number) => Promise<PdfGenerado>, filasPorPagina = 30) {
    if (!Number.isInteger(paginas) || paginas < 1 || paginas > 10) throw new Error('Seleccione entre 1 y 10 paginas');
    let minimo = 1;
    let maximo = Math.max(1, filasPorPagina * paginas);
    let cantidad = maximo;
    // El conteo procede del PDF real; no se mantiene un paginador paralelo.
    for (let intento = 0; intento < 20; intento++) {
        const resultado = await generar(cantidad);
        if (resultado.paginas === paginas) return resultado;
        if (resultado.paginas < paginas) {
            minimo = cantidad + 1;
            if (minimo > maximo) maximo *= 2;
        } else {
            maximo = cantidad - 1;
        }
        if (minimo > maximo) break;
        cantidad = Math.floor((minimo + maximo) / 2);
    }
    throw new Error('No se pudo ajustar el documento a la cantidad de paginas solicitada');
}

export function generarNotaVentaSimulada(paginas: number) {
    return ajustarPaginas(paginas, (n) => bufferVoucherPdfConPaginas(datosNotaVenta(n), OPCIONES_PRUEBA), NOTA_FORMULARIO.filasDetalle);
}

function generarNotaCompra(paginas: number) {
    return ajustarPaginas(paginas, (n) => bufferVoucherPdfConPaginas({
        ...datosNotaVenta(n), tipoDocumento: 'NOTA DE COMPRA', contraparteLabel: 'PROVEEDOR',
        contraparteNombre: 'PROVEEDOR DE PRUEBA'
    }, OPCIONES_PRUEBA), NOTA_FORMULARIO.filasDetalle);
}

function generarRecibo(tipo: DatosReciboMovimiento['tipoDocumento'], contraparte: string, concepto: string, paginas: number) {
    return ajustarPaginas(paginas, (cantidad) => {
        const lineas = Array.from({ length: cantidad }, (_, i) => ({
            codigo: `PRUEBA-${String(i + 1).padStart(3, '0')}`, descripcion: `${concepto} DE PRUEBA ${i + 1}`, importe: 100 + i * 10
        }));
        return bufferReciboPdf({
            tipoDocumento: tipo, serie: tipo === 'COBRANZA' ? 'VCRE' : tipo === 'COMPROBANTE DE INGRESO' ? 'IN' : 'EG',
            numero: 1, fecha: new Date('2026-01-15T10:30:00-04:00'), tipoCambio: 6.96,
            metodo: 'Efectivo', detalle: MARCA_PRUEBA, contraparteLabel: contraparte,
            contraparteNombre: `${contraparte} DE PRUEBA`, nitCi: '0000000000', lineas,
            total: lineas.reduce((suma, l) => suma + l.importe, 0), saldoPendiente: 0,
            referencia: 'REFERENCIA DE PRUEBA', usuario: 'USUARIO DE PRUEBA'
        }, OPCIONES_PRUEBA);
    }, 20);
}

function valorSimulado(columna: string, indice: number): Celda {
    if (/fecha|vencimiento|apertura|inicio|^fin$/i.test(columna)) return '15/01/2026';
    if (/nit|teléfono/i.test(columna)) return '0000000000';
    if (/cliente/i.test(columna)) return 'CLIENTE DE PRUEBA';
    if (/proveedor|productor|chofer/i.test(columna)) return 'PROVEEDOR DE PRUEBA';
    if (/usuario/i.test(columna)) return 'USUARIO DE PRUEBA';
    if (/^unidad$/i.test(columna)) return 'Quintal';
    if (/estado|^pago$|^despacho$/i.test(columna)) return 'PENDIENTE';
    if (/método/i.test(columna)) return 'EFECTIVO';
    if (/^nro$|^n°$|n° venta|^venta$|^compra$|días/i.test(columna)) return indice + 1;
    if (/cantidad|existencia|reservado|disponible|mínimo|fanegas|entrada|salida|merma|vendido|entregado|despachado|por entregar/i.test(columna)) return (indice % 5) + 1;
    if (/total|cobrado|pagado|pendiente|monto|precio|saldo|ingreso|egreso|compra|pago|contado|esperado|diferencia|p\. |^valor$/i.test(columna)) return 100 + indice * 10;
    return `${columna.toUpperCase()} DE PRUEBA ${indice + 1}`;
}

function generarReporte(id: keyof typeof COLUMNAS_DOCUMENTOS, titulo: string, paginas: number) {
    return ajustarPaginas(paginas, (cantidad) => {
        const columnas = COLUMNAS_DOCUMENTOS[id];
        const hoja: HojaExport = {
            nombre: titulo, titulo, plantilla: 'formal', usuario: 'USUARIO DE PRUEBA',
            consulta: [{ label: 'Datos', valor: MARCA_PRUEBA }],
            columnas, filas: Array.from({ length: cantidad }, (_, i) => columnas.map((columna) => valorSimulado(columna, i)))
        };
        const resumenes: Partial<Record<keyof typeof COLUMNAS_DOCUMENTOS, string[]>> = {
            movimientos: ['Ingresos', 'Egresos', 'Saldo neto'], ventas: ['Cantidad', 'Total', 'Cobrado'],
            compras: ['Cantidad', 'Servicios', 'Total', 'Por pagar'], egresos: ['Total'],
            cobranzas: ['Cantidad', 'Total cobrado'], pagos: ['Cantidad', 'Total pagado'],
            inventario: ['Productos'], clientes: ['Clientes'], proveedores: ['Proveedores'],
            empaques: ['Productos'], produccion: ['Producciones'], campanas: ['Campañas'], cajas: ['Cajas'],
            cuenta_proveedor: ['Saldo anterior', 'Compras', 'Servicios', 'Pagado', 'Acopios', 'Cargo', 'Abono', 'Saldo'],
            cuentas_por_cobrar: ['Total crédito', 'Total cobrado', 'Total pendiente'],
            caja: ['Saldo inicial (efectivo)', 'Ingresos', 'Egresos', 'Efectivo en caja', 'Saldo QR / banco',
                'Cobros de clientes', 'Anulaciones / devoluciones', 'Cobrado neto', 'Total esperado',
                'Efectivo contado', 'Diferencia (cajón)', 'Arqueo', 'Usuario apertura']
        };
        hoja.resumen = resumenes[id]?.map((label) => ({ label, valor: /cantidad|productos|clientes|proveedores|producciones|campañas|cajas|servicios/i.test(label)
            ? String(cantidad) : /arqueo|usuario/i.test(label) ? 'USUARIO DE PRUEBA' : cantidad * 100 }));
        if (id !== 'despachos' && id !== 'nota_entrega') hoja.subtitulo = 'Periodo de prueba: 15/01/2026';
        if (id === 'cuentas_por_cobrar') {
            hoja.tituloSecundario = 'Por documento de venta';
            hoja.mostrarFirma = true;
        }
        if (id === 'nota_entrega') {
            hoja.tituloSecundario = 'NE-000001';
            hoja.mostrarFirma = true;
            hoja.textoCompleto = true;
            hoja.consulta = [
                { label: 'Venta', valor: '#000001' }, { label: 'Cliente', valor: 'CLIENTE DE PRUEBA' },
                { label: 'Fecha/hora', valor: '15/01/2026 10:30' },
                { label: 'Persona que retira', valor: 'PERSONA DE PRUEBA' },
                { label: 'Usuario que entrega', valor: 'USUARIO DE PRUEBA' },
                { label: 'Chofer / placa', valor: 'CHOFER DE PRUEBA / PRU-000' },
                { label: 'Observacion', valor: MARCA_PRUEBA },
                { label: 'Recibido por / firma', valor: '________________________________' }
            ];
        }
        return bufferReportePdf([hoja], OPCIONES_PRUEBA);
    });
}

interface PlantillaDocumento {
    id: string; nombre: string; descripcion: string; categoria: 'Documento' | 'Reporte';
    generar: (paginas: number) => Promise<PdfGenerado>;
}
const reportes: [keyof typeof COLUMNAS_DOCUMENTOS, string][] = [
    ['resumen', 'Resumen operativo'], ['movimientos', 'Ingresos y egresos'],
    ['ventas', 'Ventas'], ['compras', 'Compras'], ['egresos', 'Gastos y retiros'],
    ['cobranzas', 'Cobranzas'], ['pagos', 'Pagos a proveedores'], ['caja', 'Detalle de caja'],
    ['cajas', 'Historial de cajas'], ['inventario', 'Inventario de productos'],
    ['clientes', 'Clientes'], ['proveedores', 'Proveedores'], ['empaques', 'Bolsas y empaques'],
    ['produccion', 'Producción'], ['campanas', 'Campañas de acopio'],
    ['cuentas_por_cobrar', 'Cuentas por cobrar'], ['cuenta_proveedor', 'Estado de cuenta del proveedor'],
    ['entregas_proveedor', 'Entregas del proveedor'], ['despachos', 'Despachos de ventas']
];

export const PLANTILLAS_DOCUMENTOS: PlantillaDocumento[] = [
    { id: 'nota-venta', nombre: 'Nota de venta', descripcion: 'Nota con cliente y productos ficticios.', categoria: 'Documento', generar: generarNotaVentaSimulada },
    { id: 'nota-compra', nombre: 'Nota de compra', descripcion: 'Nota con proveedor y productos ficticios.', categoria: 'Documento', generar: generarNotaCompra },
    { id: 'nota-entrega', nombre: 'Nota de entrega', descripcion: 'Entrega de productos, transportista y firma de retiro.', categoria: 'Documento', generar: (n) => generarReporte('nota_entrega', 'NOTA DE ENTREGA', n) },
    ...([
        ['recibo-cobranza', 'Recibo de cobranza', 'COBRANZA', 'CLIENTE', 'COBRANZA'],
        ['recibo-pago-proveedor', 'Recibo de pago a proveedor', 'COMPROBANTE DE EGRESO', 'PROVEEDOR', 'PAGO A PROVEEDOR'],
        ['comprobante-ingreso', 'Comprobante de ingreso', 'COMPROBANTE DE INGRESO', 'DOC', 'INGRESO'],
        ['comprobante-egreso', 'Comprobante de egreso', 'COMPROBANTE DE EGRESO', 'DOC', 'EGRESO'],
        ['comprobante-gasto', 'Comprobante de gasto de empresa', 'COMPROBANTE DE EGRESO', 'DOC', 'GASTO'],
        ['comprobante-retiro', 'Comprobante de retiro personal', 'COMPROBANTE DE EGRESO', 'PERSONA', 'RETIRO'],
        ['comprobante-devolucion', 'Comprobante de devolución de venta', 'COMPROBANTE DE EGRESO', 'CLIENTE', 'DEVOLUCION']
    ] as [string, string, DatosReciboMovimiento['tipoDocumento'], string, string][]).map(([id, nombre, tipo, contraparte, concepto]): PlantillaDocumento => ({
        id, nombre, descripcion: `${nombre} con importes y personas ficticias.`, categoria: 'Documento',
        generar: (n) => generarRecibo(tipo, contraparte, concepto, n)
    })),
    ...reportes.map(([id, nombre]): PlantillaDocumento => ({
        id: `reporte-${id.replace(/_/g, '-')}`, nombre, descripcion: `${nombre} con datos simulados.`, categoria: 'Reporte',
        generar: (n) => generarReporte(id, nombre, n)
    }))
];
