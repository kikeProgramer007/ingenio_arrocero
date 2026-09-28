import { formatBs, toMoney } from './money';

export function extrasPagoMixto(metodo: string | undefined, efectivo: number, qr: number): { monto_efectivo?: number; monto_qr?: number } {
    if (metodo !== 'MIXTO') {
        return {};
    }
    return { monto_efectivo: toMoney(efectivo), monto_qr: toMoney(qr) };
}

export function mensajePagoMixto(metodo: string | undefined, total: number, efectivo: number, qr: number): string | null {
    if (metodo !== 'MIXTO' || toMoney(total) <= 0) {
        return null;
    }
    const e = toMoney(efectivo);
    const q = toMoney(qr);
    if (e <= 0 || q <= 0) {
        return 'En Mixto indique cuánto es efectivo y cuánto es QR. Ambos deben ser mayores a 0.';
    }
    if (toMoney(e + q) !== toMoney(total)) {
        return `Efectivo + QR debe ser igual al monto (${formatBs(total)})`;
    }
    return null;
}
