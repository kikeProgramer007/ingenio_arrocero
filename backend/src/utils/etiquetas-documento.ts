/** Etiquetas visibles en PDF y listados. No exponer códigos internos. */

function etiquetaDe(map: Record<string, string>, valor: string | null | undefined, vacio = '-'): string {
    const clave = String(valor || '').trim();
    if (!clave) {
        return vacio;
    }
    return map[clave] || map[clave.toUpperCase()] || clave;
}

export function etiquetaTipoMovimiento(tipo: string | null | undefined): string {
    return etiquetaDe({ INGRESO: 'Ingreso', EGRESO: 'Egreso' }, tipo);
}

export function etiquetaOrigenMovimiento(origen: string | null | undefined): string {
    return etiquetaDe({
        MANUAL: 'Manual',
        VENTA: 'Venta',
        COBRANZA: 'Cobranza',
        COMPRA: 'Compra',
        GASTO: 'Gasto / retiro',
        PAGO_PROVEEDOR: 'Pago a proveedor',
        TRANSFERENCIA: 'Transferencia entre cajas',
        APORTE: 'Aporte externo'
    }, origen);
}

export function etiquetaCategoriaMovimiento(categoria: string | null | undefined): string {
    return etiquetaDe({
        VENTA: 'Venta',
        COBRANZA: 'Cobranza',
        OTRO_INGRESO: 'Otro ingreso',
        ANULACION_VENTA: 'Anulación de venta',
        PAGO_PROVEEDOR: 'Pago a proveedor',
        GASTO_EMPRESA: 'Gasto de empresa',
        RETIRO_PERSONAL: 'Retiro personal',
        OTRO_EGRESO: 'Otro egreso',
        TRANSFERENCIA_CAJA: 'Transferencia entre cajas',
        APORTE_EXTERNO: 'Aporte externo'
    }, categoria);
}

export function etiquetaMetodoPago(metodo: string | null | undefined): string {
    return etiquetaDe({
        EFECTIVO: 'Efectivo',
        QR: 'QR',
        MIXTO: 'Mixto',
        TRANSFERENCIA: 'QR',
        OTRO: 'QR'
    }, metodo);
}

export function etiquetaEstadoVenta(estado: string | null | undefined): string {
    return etiquetaDe({
        PENDIENTE: 'Pendiente',
        PARCIAL: 'Parcial',
        COMPLETA: 'Completa',
        COMPLETO: 'Completo',
        ANULADA: 'Anulada',
        VENCIDA: 'Vencida',
        PAGADA: 'Pagada',
        PAGADO: 'Pagado',
        ACTIVA: 'Activa',
        FINALIZADA: 'Finalizada',
        ABIERTA: 'Abierta',
        CERRADA: 'Cerrada'
    }, estado);
}

export function etiquetaEstadoDespacho(estado: string | null | undefined): string {
    return etiquetaDe({
        PENDIENTE: 'Pendiente',
        PARCIAL: 'Parcial',
        COMPLETO: 'Completo',
        NO_APLICA: 'No aplica',
        ABIERTOS: 'Abiertos',
        TODOS: 'Todos'
    }, estado);
}

export function etiquetaEstadoCaja(estado: string | null | undefined): string {
    return etiquetaDe({ ABIERTA: 'Abierta', CERRADA: 'Cerrada' }, estado);
}

export function etiquetaTipoGasto(tipo: string | null | undefined): string {
    return etiquetaDe({
        RETIRO_PERSONAL: 'Personal',
        GASTO_EMPRESA: 'Empresa',
        EMPRESA: 'Empresa',
        PERSONAL: 'Personal'
    }, tipo);
}

export function etiquetaTipoOperacionProveedor(tipo: string | null | undefined): string {
    return etiquetaDe({
        COMPRA: 'Compra',
        SERVICIO: 'Servicio',
        PAGO: 'Pago',
        ACOPIO: 'Acopio',
        'PAGO ACOPIO': 'Pago de acopio',
        'SALDO ANTERIOR': 'Saldo anterior',
        TOTAL: 'Total'
    }, tipo);
}

export function etiquetaDisponibleEn(valor: string | null | undefined): string {
    return etiquetaDe({ COMPRAS: 'Compras', VENTAS: 'Ventas', AMBOS: 'Ambos' }, valor, '');
}
