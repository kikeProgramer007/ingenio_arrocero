import { diasEntre, fechaComoDia, inicioDia } from '../utils/fecha';
import { toMoney } from '../utils/money';

export const CATEGORIAS_GASTO_EMPRESA = [
    'Combustible',
    'Transporte',
    'Energía',
    'Mantenimiento',
    'Repuestos',
    'Servicios',
    'Alimentación',
    'Otros'
] as const;

export type CategoriaGastoEmpresa = (typeof CATEGORIAS_GASTO_EMPRESA)[number];

/** CONTADO sale de caja al registrar. CREDITO queda como obligación por pagar. */
export const CONDICION_GASTO = {
    CONTADO: 'CONTADO',
    CREDITO: 'CREDITO'
} as const;

export const CONDICIONES_GASTO = Object.values(CONDICION_GASTO);

export const ESTADO_GASTO = {
    PENDIENTE: 'PENDIENTE',
    PARCIAL: 'PARCIAL',
    PAGADO: 'PAGADO'
} as const;

export const ESTADOS_GASTO = Object.values(ESTADO_GASTO);

export function estadoGastoPorSaldo(total: number, saldoPendiente: number): string {
    if (saldoPendiente <= 0) {
        return ESTADO_GASTO.PAGADO;
    }
    if (saldoPendiente >= total) {
        return ESTADO_GASTO.PENDIENTE;
    }
    return ESTADO_GASTO.PARCIAL;
}

/** Vencido = queda saldo y la fecha de pago ya pasó. No cambia PENDIENTE/PARCIAL/PAGADO. */
export function esGastoVencido(fechaVencimiento: unknown, saldoPendiente: unknown, estado: string): boolean {
    if (estado === ESTADO_GASTO.PAGADO || toMoney(saldoPendiente) <= 0) {
        return false;
    }
    const venc = fechaComoDia(fechaVencimiento);
    if (!venc) {
        return false;
    }
    return venc.getTime() < inicioDia().getTime();
}

export function diasGastoParaVencer(fechaVencimiento: unknown): number | null {
    const venc = fechaComoDia(fechaVencimiento);
    if (!venc) {
        return null;
    }
    return diasEntre(inicioDia(), venc);
}
