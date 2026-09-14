export const ESTADO_COMPRA = {
    PENDIENTE: 'PENDIENTE',
    PARCIAL: 'PARCIAL',
    PAGADA: 'PAGADA',
    ANULADA: 'ANULADA'
} as const;

export const ESTADOS_COMPRA = Object.values(ESTADO_COMPRA);

export function estadoCompraPorSaldo(total: number, saldoPendiente: number): string {
    if (saldoPendiente <= 0) {
        return ESTADO_COMPRA.PAGADA;
    }
    if (saldoPendiente >= total) {
        return ESTADO_COMPRA.PENDIENTE;
    }
    return ESTADO_COMPRA.PARCIAL;
}
