import type { NextFunction, Request, Response } from 'express';

/** Campos que no deben pasarse a mayúsculas (credenciales, seguridad, rutas, tokens). */
const EXCLUIDOS = new Set([
    'username',
    'usuario',
    'nickname',
    'nick',
    'email',
    'correo',
    'password',
    'password_hash',
    'clave',
    'clave_creacion',
    'clave_confirmacion',
    'token',
    'refresh_token',
    'access_token',
    'jwt',
    'authorization',
    'path_imagen',
    'path',
    'url',
    'filename',
    'originalname',
    'mimetype',
    'content_type',
    'contenttype',
    'antes',
    'despues',
    'payload',
    'mapa',
    'hash_creacion',
    'hash_confirmacion',
    'version',
    // Menú / navegación: no alterar etiquetas ni clases CSS
    'nombre_programa',
    'class_icon'
]);

export function columnaExentaDeMayusculas(clave?: string): boolean {
    if (!clave) return false;
    const k = clave.toLowerCase();
    if (EXCLUIDOS.has(k)) return true;
    return /(_password|_token|_hash|_path|_url|_secret)$/.test(k) || k.startsWith('hash_');
}

function claveExcluida(clave?: string): boolean {
    return columnaExentaDeMayusculas(clave);
}

function pareceRutaOToken(valor: string): boolean {
    if (valor.startsWith('/uploads/') || valor.startsWith('uploads/')) return true;
    if (/^data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,/i.test(valor)) return true;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor)) return true;
    // No alterar JSON serializado (auditoría, mapas, etc.).
    const t = valor.trim();
    if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) return true;
    return false;
}

/** Convierte a mayúsculas (es) todo texto que se vaya a persistir, con exclusiones seguras. */
export function mayusculizarDatos<T>(valor: T, clave?: string): T {
    if (claveExcluida(clave)) return valor;
    if (typeof valor === 'string') {
        if (!valor || pareceRutaOToken(valor)) return valor;
        return valor.toLocaleUpperCase('es') as T;
    }
    if (Array.isArray(valor)) {
        return valor.map((item) => mayusculizarDatos(item, clave)) as T;
    }
    if (valor && typeof valor === 'object') {
        if (valor instanceof Date || Buffer.isBuffer(valor)) return valor;
        // Instancia Sequelize u otros objetos no planos: no clonar.
        const proto = Object.getPrototypeOf(valor);
        if (proto && proto !== Object.prototype) return valor;
        const salida: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
            salida[k] = mayusculizarDatos(v, k);
        }
        return salida as T;
    }
    return valor;
}

export function mayusculizarInstancia(instancia: { dataValues?: Record<string, unknown>; setDataValue?: (k: string, v: unknown) => void }): void {
    const data = instancia.dataValues;
    if (!data) return;
    for (const clave of Object.keys(data)) {
        if (claveExcluida(clave)) continue;
        const actual = data[clave];
        if (typeof actual !== 'string' || !actual || pareceRutaOToken(actual)) continue;
        const convertido = actual.toLocaleUpperCase('es');
        if (convertido === actual) continue;
        if (typeof instancia.setDataValue === 'function') instancia.setDataValue(clave, convertido);
        else data[clave] = convertido;
    }
}

/** Middleware: normaliza el body de escritura a mayúsculas antes de controladores/DTOs. */
export function middlewareMayusculas(req: Request, _res: Response, next: NextFunction): void {
    if (req.body && typeof req.body === 'object') {
        req.body = mayusculizarDatos(req.body);
    }
    next();
}

/** Registra hooks globales de Sequelize para create/update. */
export function registrarHooksMayusculas(sequelize: { addHook: (nombre: string, fn: (...args: any[]) => void) => void }): void {
    sequelize.addHook('beforeCreate', (instancia: any) => mayusculizarInstancia(instancia));
    sequelize.addHook('beforeUpdate', (instancia: any) => mayusculizarInstancia(instancia));
    sequelize.addHook('beforeBulkCreate', (instancias: any[]) => {
        for (const instancia of instancias || []) mayusculizarInstancia(instancia);
    });
    sequelize.addHook('beforeBulkUpdate', (opciones: { attributes?: Record<string, unknown> }) => {
        if (opciones?.attributes) opciones.attributes = mayusculizarDatos(opciones.attributes);
    });
}
