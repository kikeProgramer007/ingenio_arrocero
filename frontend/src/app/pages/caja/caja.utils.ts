import { HttpErrorResponse } from '@angular/common/http';
import { formatBs, toMoney } from '../../shared/utils/money';

export function esErrorCajaCerrada(err: HttpErrorResponse): boolean {
    const mensaje = String(err?.error?.mensaje || err?.error?.msg || '').toLowerCase();
    return err?.status === 409 && mensaje.includes('caja abierta');
}

export { formatBs, toMoney };

export function formatHora(value: string | Date | null | undefined): string {
    if (!value) {
        return '-';
    }
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) {
        return '-';
    }
    return date.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
}

export function formatFechaCorta(value: string | Date | null | undefined): string {
    if (!value) {
        return '-';
    }
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) {
        return '-';
    }
    return date.toLocaleDateString('es-BO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

export function etiquetaOrigen(origen: string): string {
    const map: Record<string, string> = {
        MANUAL: 'Manual',
        VENTA: 'Venta',
        COBRANZA: 'Cobranza',
        COMPRA: 'Compra',
        GASTO: 'Gasto / retiro',
        PAGO_PROVEEDOR: 'Pago a proveedor'
    };
    return map[origen] || origen;
}

export function formatFecha(value: string | Date | null | undefined): string {
    if (!value) {
        return '-';
    }
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) {
        return '-';
    }
    return date.toLocaleString('es-BO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export function etiquetaCategoria(categoria: string): string {
    const map: Record<string, string> = {
        VENTA: 'Venta',
        COBRANZA: 'Cobranza',
        OTRO_INGRESO: 'Otro ingreso',
        PAGO_PROVEEDOR: 'Pago a proveedor',
        GASTO_EMPRESA: 'Gasto de empresa',
        RETIRO_PERSONAL: 'Retiro personal',
        ANULACION_VENTA: 'Anulación de venta',
        OTRO_EGRESO: 'Otro egreso'
    };
    return map[categoria] || categoria;
}

export function etiquetaMetodo(metodo: string): string {
    const map: Record<string, string> = {
        EFECTIVO: 'Efectivo',
        QR: 'QR',
        MIXTO: 'Mixto',
        TRANSFERENCIA: 'QR',
        OTRO: 'QR'
    };
    return map[metodo] || metodo || '-';
}

export function etiquetaPago(item: { metodo_pago?: string | null; monto_efectivo?: number | null; monto_qr?: number | null } | string | null | undefined): string {
    if (!item) {
        return '-';
    }
    if (typeof item === 'string') {
        return etiquetaMetodo(item);
    }
    if (item.metodo_pago === 'MIXTO') {
        return `Mixto · Ef ${formatBs(item.monto_efectivo)} + QR ${formatBs(item.monto_qr)}`;
    }
    return etiquetaMetodo(item.metodo_pago || '');
}
