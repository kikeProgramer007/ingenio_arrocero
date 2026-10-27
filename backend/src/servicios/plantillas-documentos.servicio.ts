import path from 'path';
import { EmpresaDatos } from '../utils/empresa';
import { bufferReciboPdf, bufferVoucherPdfConPaginas, DatosReciboMovimiento, DatosVoucher, NOTA_FORMULARIO } from '../utils/pdf-voucher';
import { aplicarPlantillaFormal, bufferReportePdf, Celda, HojaExport } from '../utils/exportar';
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
    const productos = [
        'ARROZ SUPERIOR GRADO 1 DE PRUEBA CON DESCRIPCIÓN EXTENSA PARA VERIFICAR SALTOS DE LÍNEA',
        'GRANILLO ESPECIAL DE PRUEBA PARA CONTROL DE ALTURA DE FILA',
        'KHAJA SELECCIONADA DE PRUEBA CON NOMBRE COMERCIAL MUY LARGO'
    ];
    const precios = [12500.5, 9800.75, 15250];
    const lineas = Array.from({ length: cantidad }, (_, i) => {
        const cantidad = (i % 5) + 1;
        const precio = precios[i % precios.length];
        return {
            codigo: `PRUEBA-${String(i + 1).padStart(3, '0')}`,
            cantidad,
            descripcion: `${productos[i % productos.length]} ${i + 1}`,
            precio,
            importe: cantidad * precio
        };
    });
    const total = lineas.reduce((suma, linea) => suma + linea.importe, 0);
    return {
        tipoDocumento: 'NOTA DE VENTA', numero: 1, fecha: new Date('2026-01-15T10:30:00-04:00'),
        contraparteLabel: 'CLIENTE',
        contraparteNombre: 'CLIENTE DE PRUEBA CON RAZÓN SOCIAL MUY EXTENSA PARA VERIFICAR QUE NO SE RECORTA',
        nitCi: '0000000000', codigoContraparte: 'PRUEBA-001',
        direccion: 'Avenida de Prueba 456, zona industrial norte, manzano 12',
        procedencia: 'LOCALIDAD DE PRUEBA CON NOMBRE EXTENSO',
        vendedor: 'VENDEDOR DE PRUEBA NOMBRE COMPLETO', tipoPago: 'Credito', plazoDias: 15,
        detalle: 'DOCUMENTO DE PRUEBA - SIN VALIDEZ COMERCIAL', lineas, total,
        cobrado: 0, pendiente: total
    };
}

async function ajustarPaginas(paginas: number, generar: (filas: number) => Promise<PdfGenerado>, filasPorPagina = 30) {
    if (!Number.isInteger(paginas) || paginas < 1 || paginas > 10) throw new Error('Seleccione entre 1 y 10 paginas');
    let minimo = 1;
    let maximo = Math.max(1, filasPorPagina * paginas);
    let cantidad = Math.max(1, Math.min(maximo, filasPorPagina));
    let mejor: PdfGenerado | null = null;
    // El conteo procede del PDF real; no se mantiene un paginador paralelo.
    for (let intento = 0; intento < 20; intento++) {
        const resultado = await generar(cantidad);
        const mejorDelta = mejor ? Math.abs(mejor.paginas - paginas) : Number.POSITIVE_INFINITY;
        const delta = Math.abs(resultado.paginas - paginas);
        if (!mejor || delta < mejorDelta || (delta === mejorDelta && resultado.paginas === paginas)) {
            mejor = resultado;
        }
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
    if (mejor) return mejor;
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
            codigo: `PRUEBA-${String(i + 1).padStart(3, '0')}`,
            descripcion: `${concepto} de prueba ${i + 1} con concepto suficientemente largo para forzar salto de línea`,
            importe: 1_250_000.5 + i * 10_000.25
        }));
        return bufferReciboPdf({
            tipoDocumento: tipo, serie: tipo === 'COBRANZA' ? 'VCRE' : tipo === 'COMPROBANTE DE INGRESO' ? 'IN' : 'EG',
            numero: 1, fecha: new Date('2026-01-15T10:30:00-04:00'), tipoCambio: 6.96,
            metodo: 'Efectivo', detalle: MARCA_PRUEBA, contraparteLabel: contraparte,
            contraparteNombre: `${contraparte} DE PRUEBA CON NOMBRE COMPLETO EXTENSO`, nitCi: '0000000000', lineas,
            total: lineas.reduce((suma, l) => suma + l.importe, 0), saldoPendiente: 0,
            referencia: 'REFERENCIA DE PRUEBA', usuario: 'USUARIO DE PRUEBA'
        }, OPCIONES_PRUEBA);
    }, 20);
}

function valorSimulado(columna: string, indice: number): Celda {
    const n = indice + 1;
    if (/fecha|vencimiento|apertura|inicio|^fin$/i.test(columna)) {
        return n % 2 ? '15/01/2026 10:30' : '31/12/2026 18:45';
    }
    if (/nit|teléfono/i.test(columna)) return '71234567';
    if (/cliente/i.test(columna)) {
        return `Cliente de Prueba con Nombre Comercial Muy Extenso ${n}`;
    }
    if (/proveedor|productor|chofer/i.test(columna)) {
        return `Proveedor Cooperativa Arrocera del Oriente con Razón Social Extensa ${n}`;
    }
    if (/usuario|persona/i.test(columna)) return `Usuario de Prueba Nombre Completo ${n}`;
    if (/^unidad$/i.test(columna)) return 'Quintal';
    if (/estado|^pago$|^despacho$/i.test(columna)) {
        return ['Pendiente', 'Parcial', 'Completa', 'Vencida'][indice % 4];
    }
    if (/método/i.test(columna)) {
        return ['Efectivo', 'QR', 'Mixto (efectivo 1.250,50 + QR 980,00)'][indice % 3];
    }
    if (/tipo de operaci|clase/i.test(columna)) {
        return ['Compra', 'Servicio', 'Pago', 'Acopio'][indice % 4];
    }
    if (/^tipo$/i.test(columna)) return n % 2 ? 'Ingreso' : 'Egreso';
    if (/origen/i.test(columna)) {
        return ['Venta', 'Cobranza', 'Gasto / retiro', 'Transferencia entre cajas', 'Aporte externo'][indice % 5];
    }
    if (/categor[ií]a/i.test(columna)) {
        return ['Venta', 'Cobranza', 'Gasto de empresa', 'Retiro personal', 'Transferencia entre cajas', 'Anulación de venta'][indice % 6];
    }
    if (/concepto|descripci|observaci|detalle|indicador|notas|direcci/i.test(columna)) {
        return `Concepto de operación de prueba número ${n}: pago de servicios, flete y comisión con descripción suficientemente larga para forzar salto de línea`;
    }
    if (/^nro$|^n°$|n° venta|^venta$|^compra$|días/i.test(columna)) return n;
    if (/cantidad|existencia|reservado|disponible|mínimo|fanegas|entrada|salida|merma|vendido|entregado|despachado|por entregar/i.test(columna)) {
        return (indice % 5) + 1;
    }
    if (/total|cobrado|pagado|pendiente|monto|precio|saldo|ingreso|egreso|compra|pago|contado|esperado|diferencia|p\. |^valor$/i.test(columna)) {
        return 1_250_000.5 + indice * 10_000.25;
    }
    return `${columna} de prueba ${n} con texto extendido`;
}

function generarReporte(id: keyof typeof COLUMNAS_DOCUMENTOS, titulo: string, paginas: number) {
    return ajustarPaginas(paginas, (cantidad) => {
        const columnas = COLUMNAS_DOCUMENTOS[id];
        const hoja: HojaExport = {
            nombre: titulo, titulo, usuario: 'Usuario de Prueba Nombre Completo',
            consulta: [{ label: 'Datos', valor: MARCA_PRUEBA }],
            columnas, filas: Array.from({ length: cantidad }, (_, i) => columnas.map((columna) => valorSimulado(columna, i)))
        };
        const resumenes: Partial<Record<keyof typeof COLUMNAS_DOCUMENTOS, string[]>> = {
            movimientos: ['Ingresos', 'Egresos', 'Saldo neto'], ventas: ['Cantidad', 'Total', 'Cobrado'],
            compras: ['Cantidad', 'Servicios', 'Total', 'Por pagar'], egresos: ['Total'],
            cobranzas: ['Cantidad', 'Total cobrado'], pagos: ['Cantidad', 'Total pagado'],
            inventario: ['Productos'], clientes: ['Clientes'], proveedores: ['Proveedores'],
            empaques: ['Productos'], produccion: ['Producciones'], campanas: ['Campañas'], cajas: ['Cajas'],
            cuenta_proveedor: ['Saldo anterior', 'Compras', 'Servicios', 'Pagado', 'Cargo', 'Abono', 'Saldo'],
            cuentas_por_cobrar: ['Total crédito', 'Total cobrado', 'Total pendiente'],
            cuentas_por_pagar: ['Compras Bs', 'Pagos Bs', 'Saldo Bs'],
            caja: ['Saldo inicial (efectivo)', 'Ingresos', 'Egresos', 'Efectivo en caja', 'Saldo QR / banco',
                'Cobros de clientes', 'Anulaciones / devoluciones', 'Cobrado neto', 'Total esperado',
                'Efectivo contado', 'Diferencia (cajón)', 'Arqueo', 'Usuario apertura']
        };
        hoja.resumen = resumenes[id]?.map((label) => ({ label, valor: /cantidad|productos|clientes|proveedores|producciones|campañas|cajas|servicios/i.test(label)
            ? String(cantidad) : /arqueo|usuario/i.test(label) ? 'Usuario de Prueba Nombre Completo' : 1_250_000.5 + cantidad * 100 }));
        if (id !== 'despachos' && id !== 'nota_entrega') hoja.subtitulo = 'Período de prueba: 15/01/2026 — 31/12/2026';
        if (id === 'cuentas_por_cobrar') {
            hoja.tituloSecundario = 'Por documento de venta';
        }
        if (id === 'nota_entrega') {
            hoja.plantilla = 'formal';
            hoja.tituloSecundario = 'NE-000001';
            hoja.mostrarFirma = true;
            hoja.textoCompleto = true;
            hoja.consulta = [
                { label: 'Venta', valor: '#000001' },
                { label: 'Cliente', valor: 'Cliente de Prueba con Nombre Comercial Muy Extenso' },
                { label: 'Fecha/hora', valor: '15/01/2026 10:30' },
                { label: 'Chofer', valor: 'Chofer de Prueba Nombre Completo' },
                { label: 'CI del chofer', valor: '12345678' },
                { label: 'Placa', valor: 'PRU-0001' },
                { label: 'Marca del camión', valor: 'Marca de camión de prueba' },
                { label: 'Color', valor: 'Blanco' },
                { label: 'Destino', valor: 'Destino de entrega con dirección suficientemente larga para verificar saltos' },
                { label: 'Usuario que entrega', valor: 'Usuario de Prueba Nombre Completo' },
                { label: 'Observacion', valor: MARCA_PRUEBA },
                { label: 'Firma del chofer', valor: '________________________________' }
            ];
        } else {
            aplicarPlantillaFormal(hoja, hoja.consulta || []);
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
    ['cuentas_por_cobrar', 'Cuentas por cobrar'], ['cuentas_por_pagar', 'Cuentas por pagar'],
    ['cuenta_proveedor', 'Estado de cuenta del proveedor'],
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
