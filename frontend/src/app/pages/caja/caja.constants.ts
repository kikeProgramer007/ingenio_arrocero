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

export const METODO_PAGO = {
    EFECTIVO: 'EFECTIVO',
    QR: 'QR',
    TRANSFERENCIA: 'TRANSFERENCIA',
    OTRO: 'OTRO'
} as const;

export const CATEGORIAS_POR_TIPO: Record<string, { label: string; value: string }[]> = {
    INGRESO: [
        { label: 'Venta', value: CATEGORIA_INGRESO.VENTA },
        { label: 'Cobranza', value: CATEGORIA_INGRESO.COBRANZA },
        { label: 'Otro ingreso', value: CATEGORIA_INGRESO.OTRO_INGRESO }
    ],
    EGRESO: [
        { label: 'Pago a proveedor', value: CATEGORIA_EGRESO.PAGO_PROVEEDOR },
        { label: 'Gasto de empresa', value: CATEGORIA_EGRESO.GASTO_EMPRESA },
        { label: 'Retiro personal', value: CATEGORIA_EGRESO.RETIRO_PERSONAL },
        { label: 'Otro egreso', value: CATEGORIA_EGRESO.OTRO_EGRESO }
    ]
};

export const TIPOS_MOVIMIENTO_OPTIONS = [
    { label: 'Ingreso', value: TIPO_MOVIMIENTO.INGRESO },
    { label: 'Egreso', value: TIPO_MOVIMIENTO.EGRESO }
];

export const METODOS_PAGO_OPTIONS = [
    { label: 'Efectivo', value: METODO_PAGO.EFECTIVO },
    { label: 'QR', value: METODO_PAGO.QR },
    { label: 'Transferencia', value: METODO_PAGO.TRANSFERENCIA },
    { label: 'Otro', value: METODO_PAGO.OTRO }
];

export const ESTADOS_CAJA_OPTIONS = [
    { label: 'Todas', value: '' },
    { label: 'Abierta', value: ESTADO_CAJA.ABIERTA },
    { label: 'Cerrada', value: ESTADO_CAJA.CERRADA }
];
