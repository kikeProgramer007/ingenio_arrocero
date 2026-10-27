import { HttpParams } from '@angular/common/http';

export function coincideFiltro(valor: unknown, seleccion?: Array<string | number> | null): boolean {
    if (!seleccion?.length) {
        return true;
    }
    return seleccion.map(String).includes(String(valor));
}

export function coincideActivo(activo: boolean, seleccion?: string[] | null): boolean {
    if (!seleccion?.length || seleccion.length >= 2) {
        return true;
    }
    if (seleccion[0] === 'activos') {
        return activo;
    }
    if (seleccion[0] === 'inactivos') {
        return !activo;
    }
    return true;
}

export function comoLista(valor?: string | number | Array<string | number> | null): Array<string | number> | undefined {
    if (valor == null || valor === '') {
        return undefined;
    }
    return Array.isArray(valor) ? valor : [valor];
}

export function parametrosLista(params: HttpParams, clave: string, valores?: Array<string | number> | null): HttpParams {
    if (!valores?.length) {
        return params;
    }
    for (const valor of valores) {
        if (valor !== undefined && valor !== null && valor !== '') {
            params = params.append(clave, String(valor));
        }
    }
    return params;
}

export function activosParam(seleccion?: string[] | null): string | undefined {
    if (!seleccion?.length || seleccion.length >= 2) {
        return undefined;
    }
    return seleccion[0];
}
