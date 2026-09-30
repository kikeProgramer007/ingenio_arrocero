import fs from 'fs';
import path from 'path';
import { Empresa } from '../models/empresa.model';
import { uploadsRoot } from './imagen';

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
};

const LOGO_DEFAULT = '/uploads/defaults/logotipo.jpeg';

function textoEnv(clave: string, respaldo = ''): string {
    return (process.env[clave] || respaldo).trim();
}

export function datosEmpresaFallback(): EmpresaDatos {
    return {
        id: 0,
        nombre: textoEnv('EMPRESA_NOMBRE', 'Ingenio Arrocero Royal'),
        nombre_corto: textoEnv('EMPRESA_NOMBRE_CORTO', 'Royal Alimentos'),
        slogan: textoEnv('EMPRESA_SLOGAN', 'Ingenio arrocero'),
        titular: textoEnv('EMPRESA_TITULAR'),
        nit: textoEnv('EMPRESA_NIT'),
        direccion: textoEnv('EMPRESA_DIRECCION'),
        telefono: textoEnv('EMPRESA_TELEFONO'),
        ciudad: textoEnv('EMPRESA_CIUDAD'),
        email: textoEnv('EMPRESA_EMAIL'),
        path_logo: LOGO_DEFAULT
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
        path_logo: pathLogo
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
            path_logo: LOGO_DEFAULT
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
