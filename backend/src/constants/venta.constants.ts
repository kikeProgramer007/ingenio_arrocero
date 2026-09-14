export const ESTADO_VENTA = {
    PENDIENTE: 'PENDIENTE',
    PARCIAL: 'PARCIAL',
    PAGADA: 'PAGADA',
    ANULADA: 'ANULADA'
} as const;

export const ESTADOS_VENTA = Object.values(ESTADO_VENTA);

export function estadoVentaPorSaldo(total: number, saldoPendiente: number): string {
    if (saldoPendiente <= 0) {
        return ESTADO_VENTA.PAGADA;
    }
    if (saldoPendiente >= total) {
        return ESTADO_VENTA.PENDIENTE;
    }
    return ESTADO_VENTA.PARCIAL;
}
