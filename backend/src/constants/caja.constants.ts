export const ESTADO_CAJA = {
    ABIERTA: 'ABIERTA',
    CERRADA: 'CERRADA'
} as const;

export const TIPO_MOVIMIENTO = {
    INGRESO: 'INGRESO',
    EGRESO: 'EGRESO'
} as const;

export const CATEGORIA_INGRESO = {
    VENTA: 'VENTA',
    COBRANZA: 'COBRANZA',
    OTRO_INGRESO: 'OTRO_INGRESO'
} as const;

export const CATEGORIA_EGRESO = {
    PAGO_PROVEEDOR: 'PAGO_PROVEEDOR',
    GASTO_EMPRESA: 'GASTO_EMPRESA',
    RETIRO_PERSONAL: 'RETIRO_PERSONAL',
    OTRO_EGRESO: 'OTRO_EGRESO'
} as const;

export const CATEGORIAS_POR_TIPO = {
    [TIPO_MOVIMIENTO.INGRESO]: Object.values(CATEGORIA_INGRESO),
    [TIPO_MOVIMIENTO.EGRESO]: Object.values(CATEGORIA_EGRESO)
} as const;

export const METODO_PAGO = {
    EFECTIVO: 'EFECTIVO',
    QR: 'QR',
    TRANSFERENCIA: 'TRANSFERENCIA',
    OTRO: 'OTRO'
} as const;

export const ORIGEN_MOVIMIENTO = {
    MANUAL: 'MANUAL',
    VENTA: 'VENTA',
    COBRANZA: 'COBRANZA',
    COMPRA: 'COMPRA',
    GASTO: 'GASTO',
    PAGO_PROVEEDOR: 'PAGO_PROVEEDOR'
} as const;

export const RESULTADO_ARQUEO = {
    CUADRE: 'CUADRE',
    FALTANTE: 'FALTANTE',
    SOBRANTE: 'SOBRANTE'
} as const;

export const ESTADOS_CAJA = Object.values(ESTADO_CAJA);
export const TIPOS_MOVIMIENTO = Object.values(TIPO_MOVIMIENTO);
export const CATEGORIAS_MOVIMIENTO = [
    ...Object.values(CATEGORIA_INGRESO),
    ...Object.values(CATEGORIA_EGRESO)
];
export const METODOS_PAGO = Object.values(METODO_PAGO);
