import fs from 'fs';
import path from 'path';
import { TIPO_CAMBIO_DEFAULT } from '../constants/compra.constants';
import { Empresa } from '../models/empresa.model';
import { uploadsRoot } from './imagen';

export const FORMATOS_NOTA = ['11', '5.5'] as const;
export type FormatoNota = (typeof FORMATOS_NOTA)[number];

export type EmpresaDatos = {
    id: number;
    nombre: string;
    nombre_corto: string;
    slogan: string;
    titular: string;
    nit: string;
    direccion: string;
    telefono: string;
    ciudad: string;
    email: string;
    path_logo: string;
    formato_nota: FormatoNota;
    tipo_cambio: number;
};

export function normalizarFormatoNota(valor: unknown): FormatoNota {
    return String(valor || '').trim() === '5.5' ? '5.5' : '11';
}

export function normalizarTipoCambio(valor: unknown, respaldo = TIPO_CAMBIO_DEFAULT): number {
    const n = Number(valor);
    return Number.isFinite(n) && n > 0 ? Number(n.toFixed(4)) : respaldo;
}

const LOGO_DEFAULT = '/uploads/defaults/logotipo.jpeg';

function textoEnv(clave: string, respaldo = ''): string {
    return (process.env[clave] || respaldo).trim();
}

export function datosEmpresaFallback(): EmpresaDatos {
    return {
        id: 0,
        nombre: textoEnv('EMPRESA_NOMBRE', 'Comercial Demo'),
        nombre_corto: textoEnv('EMPRESA_NOMBRE_CORTO', 'Empresa Demo'),
        slogan: textoEnv('EMPRESA_SLOGAN', 'Sistema de gestión comercial'),
        titular: textoEnv('EMPRESA_TITULAR'),
        nit: textoEnv('EMPRESA_NIT'),
        direccion: textoEnv('EMPRESA_DIRECCION'),
        telefono: textoEnv('EMPRESA_TELEFONO'),
        ciudad: textoEnv('EMPRESA_CIUDAD'),
        email: textoEnv('EMPRESA_EMAIL'),
        path_logo: LOGO_DEFAULT,
        formato_nota: normalizarFormatoNota(textoEnv('EMPRESA_FORMATO_NOTA', '11')),
        tipo_cambio: normalizarTipoCambio(textoEnv('EMPRESA_TIPO_CAMBIO'), TIPO_CAMBIO_DEFAULT)
    };
}

export function mapEmpresa(row: any): EmpresaDatos {
    const fallback = datosEmpresaFallback();
    const pathLogo = String(row?.path_logo || '').trim() || LOGO_DEFAULT;
    return {
        id: Number(row?.id) || 0,
        nombre: String(row?.nombre || '').trim() || fallback.nombre,
        nombre_corto: String(row?.nombre_corto || '').trim() || fallback.nombre_corto,
        slogan: String(row?.slogan || '').trim() || fallback.slogan,
        titular: String(row?.titular || '').trim(),
        nit: String(row?.nit || '').trim(),
        direccion: String(row?.direccion || '').trim(),
        telefono: String(row?.telefono || '').trim(),
        ciudad: String(row?.ciudad || '').trim(),
        email: String(row?.email || '').trim(),
        path_logo: pathLogo,
        formato_nota: normalizarFormatoNota(row?.formato_nota),
        tipo_cambio: normalizarTipoCambio(row?.tipo_cambio, fallback.tipo_cambio)
    };
}

let cache: EmpresaDatos | null = null;

export function datosEmpresa(): EmpresaDatos {
    return cache || datosEmpresaFallback();
}

export async function refrescarEmpresa(): Promise<EmpresaDatos> {
    try {
        const row = await Empresa.findOne({ order: [['id', 'ASC']] });
        cache = row ? mapEmpresa(row) : datosEmpresaFallback();
    } catch {
        cache = datosEmpresaFallback();
    }
    return cache;
}

export async function asegurarEmpresa(): Promise<void> {
    const cantidad = await Empresa.count();
    if (!cantidad) {
        const inicial = datosEmpresaFallback();
        await Empresa.create({
            nombre: inicial.nombre,
            nombre_corto: inicial.nombre_corto,
            slogan: inicial.slogan,
            titular: inicial.titular || null,
            nit: inicial.nit || null,
            direccion: inicial.direccion || null,
            telefono: inicial.telefono || null,
            ciudad: inicial.ciudad || null,
            email: inicial.email || null,
            path_logo: LOGO_DEFAULT,
            formato_nota: inicial.formato_nota,
            tipo_cambio: inicial.tipo_cambio
        });
    }
    await refrescarEmpresa();
}

export function rutaLogotipo(): string | null {
    const relativo = (datosEmpresa().path_logo || '').replace(/^\/uploads\/?/, '');
    if (relativo) {
        const archivo = path.join(uploadsRoot(), relativo);
        if (fs.existsSync(archivo)) {
            return archivo;
        }
    }
    const respaldo = path.join(uploadsRoot(), 'defaults', 'logotipo.jpeg');
    return fs.existsSync(respaldo) ? respaldo : null;
}
