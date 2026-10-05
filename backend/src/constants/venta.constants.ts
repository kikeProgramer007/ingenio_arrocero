import { fechaComoDia, inicioDia } from '../utils/fecha';
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

/** Vencida = hay saldo y la fecha de pago ya pasó. No cambia PENDIENTE/PARCIAL/PAGADA. */
export function esVentaVencida(fechaVencimiento: unknown, saldoPendiente: unknown, estado: string): boolean {
    if (estado === ESTADO_VENTA.ANULADA || estado === ESTADO_VENTA.PAGADA) {
        return false;
    }
    if (toMoney(saldoPendiente) <= 0) {
        return false;
    }
    const venc = fechaComoDia(fechaVencimiento);
    if (!venc) {
        return false;
    }
    return venc.getTime() < inicioDia().getTime();
}
