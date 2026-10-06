import { diasEntre, fechaComoDia, inicioDia } from '../utils/fecha';
import { roundMoney, toMoney } from '../utils/money';

/** Días antes del vencimiento en que un crédito se considera "por vencer". */
export const DIAS_AVISO_VENCIMIENTO = 7;

export const SITUACION_COBRANZA = {
    PAGADA: 'PAGADA',
    SIN_PLAZO: 'SIN PLAZO',
    AL_DIA: 'AL DIA',
    POR_VENCER: 'POR VENCER',
    VENCE_HOY: 'VENCE HOY',
    VENCIDA: 'VENCIDA'
} as const;

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

/** Días hasta el vencimiento: negativo si ya pasó, null si no hay plazo. */
export function diasParaVencer(fechaVencimiento: unknown): number | null {
    const venc = fechaComoDia(fechaVencimiento);
    if (!venc) {
        return null;
    }
    return diasEntre(inicioDia(), venc);
}

/** Situación de cobranza para el recordatorio interno. No reemplaza al estado de pago. */
export function situacionCobranza(fechaVencimiento: unknown, saldoPendiente: unknown, estado: string): string {
    if (estado === ESTADO_VENTA.PAGADA || toMoney(saldoPendiente) <= 0) {
        return SITUACION_COBRANZA.PAGADA;
    }
    const dias = diasParaVencer(fechaVencimiento);
    if (dias === null) {
        return SITUACION_COBRANZA.SIN_PLAZO;
    }
    if (dias < 0) {
        return SITUACION_COBRANZA.VENCIDA;
    }
    if (dias === 0) {
        return SITUACION_COBRANZA.VENCE_HOY;
    }
    return dias <= DIAS_AVISO_VENCIMIENTO ? SITUACION_COBRANZA.POR_VENCER : SITUACION_COBRANZA.AL_DIA;
}
