import { METODO_PAGO } from '../constants/caja.constants';
import { roundMoney, toMoney } from './money';

export type CanalPago = 'EFECTIVO' | 'QR';

export interface PartePago {
    metodo: CanalPago;
    monto: number;
}

export interface ResultadoPartesPago {
    ok: true;
    partes: PartePago[];
    monto_efectivo: number;
    monto_qr: number;
}

export interface ErrorPartesPago {
    ok: false;
    mensaje: string;
}

/** Efectivo = cajón. QR, transferencia u otro histórico = banco. */
export function canalMetodo(metodo: string | null | undefined): CanalPago {
    return String(metodo || '') === METODO_PAGO.EFECTIVO ? 'EFECTIVO' : 'QR';
}

export function resolverPartesPago(opts: {
    metodo?: string | null;
    monto: number;
    monto_efectivo?: number | null;
    monto_qr?: number | null;
}): ResultadoPartesPago | ErrorPartesPago {
    const monto = roundMoney(opts.monto);
    const metodo = String(opts.metodo || '');
    if (monto <= 0) {
        return { ok: false, mensaje: 'El monto debe ser mayor a 0' };
    }
    if (metodo === METODO_PAGO.MIXTO) {
        const efectivo = roundMoney(toMoney(opts.monto_efectivo));
        const qr = roundMoney(toMoney(opts.monto_qr));
        if (efectivo <= 0 || qr <= 0) {
            return { ok: false, mensaje: 'En pago mixto indique cuánto es efectivo y cuánto es QR. Ambos deben ser mayores a 0.' };
        }
        if (roundMoney(efectivo + qr) !== monto) {
            return { ok: false, mensaje: `Efectivo + QR debe ser igual al monto (${monto.toFixed(2)})` };
        }
        return {
            ok: true,
            partes: [
                { metodo: 'EFECTIVO', monto: efectivo },
                { metodo: 'QR', monto: qr }
            ],
            monto_efectivo: efectivo,
            monto_qr: qr
        };
    }
    if (metodo === METODO_PAGO.EFECTIVO) {
        return { ok: true, partes: [{ metodo: 'EFECTIVO', monto }], monto_efectivo: monto, monto_qr: 0 };
    }
    if (metodo === METODO_PAGO.QR || metodo === 'TRANSFERENCIA' || metodo === 'OTRO') {
        return { ok: true, partes: [{ metodo: 'QR', monto }], monto_efectivo: 0, monto_qr: monto };
    }
    return { ok: false, mensaje: 'El método de pago no es válido. Use Efectivo, QR o Mixto.' };
}

export function conceptoPorCanal(concepto: string, parte: PartePago, totalPartes: number): string {
    if (totalPartes < 2) {
        return concepto;
    }
    const sufijo = parte.metodo === 'EFECTIVO' ? 'efectivo' : 'QR';
    return `${concepto} (${sufijo})`;
}

export function partesDesdeDocumento(doc: {
    metodo_pago?: string | null;
    monto?: unknown;
    monto_efectivo?: unknown;
    monto_qr?: unknown;
}): PartePago[] {
    const monto = toMoney(doc.monto);
    const res = resolverPartesPago({
        metodo: doc.metodo_pago,
        monto,
        monto_efectivo: toMoney(doc.monto_efectivo),
        monto_qr: toMoney(doc.monto_qr)
    });
    if (res.ok) {
        return res.partes;
    }
    return [{ metodo: canalMetodo(doc.metodo_pago), monto }];
}

export function camposPagoDocumento(datos: {
    metodo_pago?: string | null;
    monto_efectivo?: number | null;
    monto_qr?: number | null;
}, monto: number) {
    const res = resolverPartesPago({
        metodo: datos.metodo_pago,
        monto,
        monto_efectivo: datos.monto_efectivo,
        monto_qr: datos.monto_qr
    });
    if (!res.ok) {
        return res;
    }
    return {
        ok: true as const,
        metodo_pago: String(datos.metodo_pago),
        monto,
        monto_efectivo: res.monto_efectivo,
        monto_qr: res.monto_qr
    };
}

export function etiquetaMetodoDetalle(item: {
    metodo_pago?: string | null;
    monto_efectivo?: unknown;
    monto_qr?: unknown;
}): string {
    const metodo = String(item.metodo_pago || '');
    if (metodo === METODO_PAGO.MIXTO) {
        return `Mixto (efectivo ${toMoney(item.monto_efectivo).toFixed(2)} + QR ${toMoney(item.monto_qr).toFixed(2)})`;
    }
    if (metodo === METODO_PAGO.EFECTIVO) {
        return 'Efectivo';
    }
    if (metodo === METODO_PAGO.QR) {
        return 'QR';
    }
    if (metodo === 'TRANSFERENCIA') {
        return 'QR';
    }
    if (metodo === 'OTRO') {
        return 'QR';
    }
    return metodo || '-';
}
