export const ESTADO_COMPRA = {
    PENDIENTE: 'PENDIENTE',
    PARCIAL: 'PARCIAL',
    PAGADA: 'PAGADA',
    ANULADA: 'ANULADA'
} as const;

export const ESTADOS_COMPRA = Object.values(ESTADO_COMPRA);

export const TIPO_COMPRA = {
    CHALA: 'CHALA',
    BOLSAS: 'BOLSAS',
    OTROS: 'OTROS'
} as const;

export const TIPOS_COMPRA = Object.values(TIPO_COMPRA);

export const TIPO_CAMBIO_DEFAULT = 9.96;

export function etiquetaTipoCompra(tipo: string | null | undefined): string {
    if (tipo === TIPO_COMPRA.CHALA) return 'Arroz en chala';
    if (tipo === TIPO_COMPRA.BOLSAS) return 'Bolsas y empaques';
    if (tipo === TIPO_COMPRA.OTROS) return 'Otros / servicios';
    return 'Compra';
}

export function inferirTipoCompra(compra: { tipo_compra?: unknown; fanegas?: unknown; boleta?: unknown }): string {
    const tipo = String(compra?.tipo_compra || '').toUpperCase();
    if (tipo === TIPO_COMPRA.CHALA || tipo === TIPO_COMPRA.BOLSAS || tipo === TIPO_COMPRA.OTROS) {
        return tipo;
    }
    if ((compra?.fanegas != null && Number(compra.fanegas) > 0) || String(compra?.boleta || '').trim()) {
        return TIPO_COMPRA.CHALA;
    }
    return TIPO_COMPRA.OTROS;
}

export function estadoCompraPorSaldo(total: number, saldoPendiente: number): string {
    if (saldoPendiente <= 0) {
        return ESTADO_COMPRA.PAGADA;
    }
    if (saldoPendiente >= total) {
        return ESTADO_COMPRA.PENDIENTE;
    }
    return ESTADO_COMPRA.PARCIAL;
}
