import { roundMoney, toMoney } from '../utils/money';

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

/** Lo cobrado del documento: 0 si está anulada (el dinero se revirtió en caja). */
export function cobradoVenta(total: unknown, saldoPendiente: unknown, estado: string): number {
    if (estado === ESTADO_VENTA.ANULADA) {
        return 0;
    }
    return roundMoney(toMoney(total) - toMoney(saldoPendiente));
}

export function saldoVenta(saldoPendiente: unknown, estado: string): number {
    if (estado === ESTADO_VENTA.ANULADA) {
        return 0;
    }
    return toMoney(saldoPendiente);
}
