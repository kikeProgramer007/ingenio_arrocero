import { HttpErrorResponse } from '@angular/common/http';
import { ErrorApiMapeado } from '../models/errores.interface';

const MENSAJES_GENERICOS = new Set([
    'error de validación',
    'error en la validación',
    'error interno del servidor',
    'ha ocurrido un error en el servidor',
    'validation error',
    'bad request'
]);

function esHttp(err: unknown): err is HttpErrorResponse {
    return !!err && typeof err === 'object' && (err as HttpErrorResponse).status !== undefined && 'error' in (err as object);
}

function limpio(valor: unknown): string {
    return String(valor || '').trim();
}

function campo(obj: Record<string, unknown> | null | undefined, clave: string): unknown {
    return obj ? obj[clave] : undefined;
}

function extraerLista(valor: unknown): string[] {
    if (!valor) {
        return [];
    }
    if (Array.isArray(valor)) {
        return valor.flatMap((item) => {
            if (typeof item === 'string' || typeof item === 'number') {
                return [limpio(item)];
            }
            if (item && typeof item === 'object') {
                const row = item as Record<string, unknown>;
                if (Array.isArray(campo(row, 'mensajes'))) {
                    return extraerLista(campo(row, 'mensajes'));
                }
                const constraints = campo(row, 'constraints');
                if (constraints && typeof constraints === 'object') {
                    return Object.values(constraints as Record<string, unknown>).map((v) => limpio(v));
                }
                if (campo(row, 'mensaje')) {
                    return [limpio(campo(row, 'mensaje'))];
                }
                if (campo(row, 'message')) {
                    return [limpio(campo(row, 'message'))];
                }
                return Object.values(row).flatMap((v) => (typeof v === 'string' ? [limpio(v)] : []));
            }
            return [];
        }).filter(Boolean);
    }
    if (typeof valor === 'string') {
        return valor ? [valor] : [];
    }
    if (typeof valor === 'object') {
        return extraerLista(Object.values(valor as Record<string, unknown>));
    }
    return [];
}

function parsearCuerpo(cuerpo: unknown): Record<string, unknown> | string | null {
    if (cuerpo == null) {
        return null;
    }
    if (typeof cuerpo === 'string') {
        const texto = cuerpo.trim();
        if (!texto || texto.startsWith('<')) {
            return texto.startsWith('<') ? null : texto;
        }
        try {
            return JSON.parse(texto) as Record<string, unknown>;
        } catch {
            return texto;
        }
    }
    if (typeof cuerpo === 'object' && !(cuerpo instanceof Blob)) {
        return cuerpo as Record<string, unknown>;
    }
    return null;
}

function cuerpoTexto(cuerpo: unknown): string {
    if (cuerpo == null || cuerpo instanceof Blob) {
        return '';
    }
    if (typeof cuerpo === 'string') {
        return cuerpo.trim().startsWith('<') ? '' : cuerpo.slice(0, 4000);
    }
    try {
        return JSON.stringify(cuerpo, null, 2).slice(0, 4000);
    } catch {
        return '';
    }
}

function mensajePorEstado(status: number, fallback: string): string {
    if (status === 0) {
        return 'No hay conexión con el servidor';
    }
    if (status === 401) {
        return 'La sesión expiró o no está autorizado';
    }
    if (status === 403) {
        return 'No tiene permiso para esta acción';
    }
    if (status === 404) {
        return 'No se encontró el recurso';
    }
    if (status === 409) {
        return fallback;
    }
    if (status >= 500) {
        return 'Error interno del servidor';
    }
    return fallback;
}

export function mapearErrorHttp(err: unknown, fallback = 'No se pudo completar la operación'): ErrorApiMapeado {
    if (!esHttp(err)) {
        const mensaje = err instanceof Error ? err.message : fallback;
        return { mensaje, resumen: mensaje, errores: mensaje ? [mensaje] : [], estado: null, cuerpoTexto: '' };
    }

    const cuerpo = parsearCuerpo(err.error);
    const obj = cuerpo && typeof cuerpo === 'object' ? cuerpo : null;
    const errores = extraerLista(campo(obj, 'errores') ?? campo(obj, 'errors') ?? campo(obj, 'messages') ?? campo(obj, 'message'));
    const mensajeRaw = campo(obj, 'mensaje') || campo(obj, 'msg') || (typeof campo(obj, 'message') === 'string' ? campo(obj, 'message') : '') || (typeof cuerpo === 'string' ? cuerpo : '');
    const mensajeCuerpo = limpio(mensajeRaw);
    const mensaje = mensajeCuerpo || mensajePorEstado(err.status, fallback);
    const especificos = errores.filter((item) => item.toLowerCase() !== mensaje.toLowerCase());
    const resumen = MENSAJES_GENERICOS.has(mensaje.toLowerCase())
        ? (especificos[0] || errores[0] || mensaje)
        : (especificos[0] && especificos[0] !== mensaje ? `${mensaje}: ${especificos[0]}` : mensaje);

    const lista = [...new Set(errores.length ? errores : (mensaje ? [mensaje] : [fallback]))];
    return {
        mensaje,
        resumen,
        errores: lista,
        estado: err.status || null,
        cuerpoTexto: cuerpoTexto(err.error)
    };
}
