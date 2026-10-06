import { agregarDias, diasEntre, inicioDia, parseFechaLocal, ymdLocal } from './fecha';

export type PlazoCredito =
    | { ok: true; plazo_dias: number | null; fecha_vencimiento: string | null }
    | { ok: false; mensaje: string };

/** Traduce plazo en días o fecha explícita a (plazo_dias, fecha_vencimiento). Sin saldo no hay vencimiento. */
export function resolverPlazoCredito(
    saldoPendiente: number,
    plazoDias?: number,
    fechaVencimiento?: string
): PlazoCredito {
    if (saldoPendiente <= 0) {
        return { ok: true, plazo_dias: null, fecha_vencimiento: null };
    }
    const hoy = inicioDia();
    if (fechaVencimiento) {
        const venc = parseFechaLocal(fechaVencimiento);
        if (Number.isNaN(venc.getTime())) {
            return { ok: false, mensaje: 'La fecha de vencimiento no es válida' };
        }
        if (inicioDia(venc).getTime() < hoy.getTime()) {
            return { ok: false, mensaje: 'La fecha de vencimiento no puede ser anterior a hoy' };
        }
        return {
            ok: true,
            plazo_dias: Math.max(1, diasEntre(hoy, venc)),
            fecha_vencimiento: ymdLocal(venc)
        };
    }
    if (plazoDias) {
        const venc = agregarDias(hoy, plazoDias);
        return { ok: true, plazo_dias: plazoDias, fecha_vencimiento: ymdLocal(venc) };
    }
    return { ok: true, plazo_dias: null, fecha_vencimiento: null };
}
