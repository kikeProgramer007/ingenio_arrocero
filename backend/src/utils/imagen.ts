import fs from 'fs';
import path from 'path';

export type TipoImagen = 'producto' | 'cliente' | 'proveedor';

export const IMAGEN_DEFAULT: Record<TipoImagen, string> = {
    producto: '/uploads/defaults/producto.svg',
    cliente: '/uploads/defaults/cliente.svg',
    proveedor: '/uploads/defaults/proveedor.svg'
};

export function uploadsRoot(): string {
    return path.join(__dirname, '..', '..', 'uploads');
}

export function resolverImagen(pathImagen: string | null | undefined, tipo: TipoImagen): string {
    const valor = (pathImagen || '').trim();
    if (!valor) {
        return IMAGEN_DEFAULT[tipo];
    }
    return valor;
}

export function imagenParaGuardar(pathImagen: string | null | undefined, tipo: TipoImagen): string {
    return resolverImagen(pathImagen, tipo);
}

const SVG: Record<TipoImagen, string> = {
    producto: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <rect width="256" height="256" rx="28" fill="#E8F5E9"/>
  <path d="M78 86h100c8 0 14 6 14 14v86c0 18-16 32-36 32H100c-20 0-36-14-36-32V100c0-8 6-14 14-14z" fill="#66BB6A"/>
  <path d="M88 86c0-22 18-40 40-40s40 18 40 40" fill="none" stroke="#2E7D32" stroke-width="10"/>
  <circle cx="128" cy="150" r="22" fill="#FFF8E1"/>
  <path d="M118 150h20M128 140v20" stroke="#F9A825" stroke-width="6" stroke-linecap="round"/>
</svg>`,
    cliente: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <rect width="256" height="256" rx="28" fill="#E3F2FD"/>
  <circle cx="128" cy="96" r="40" fill="#42A5F5"/>
  <path d="M56 214c8-44 40-66 72-66s64 22 72 66" fill="#90CAF9"/>
</svg>`,
    proveedor: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <rect width="256" height="256" rx="28" fill="#FFF3E0"/>
  <rect x="40" y="92" width="110" height="70" rx="8" fill="#FB8C00"/>
  <path d="M150 102h46l20 28v32h-66V102z" fill="#EF6C00"/>
  <circle cx="78" cy="176" r="16" fill="#5D4037"/>
  <circle cx="186" cy="176" r="16" fill="#5D4037"/>
</svg>`
};

export function asegurarDirectoriosImagen(): void {
    const root = uploadsRoot();
    for (const dir of ['defaults', 'productos', 'clientes', 'proveedores']) {
        fs.mkdirSync(path.join(root, dir), { recursive: true });
    }
    (Object.keys(SVG) as TipoImagen[]).forEach((tipo) => {
        const file = path.join(root, 'defaults', `${tipo}.svg`);
        if (!fs.existsSync(file)) {
            fs.writeFileSync(file, SVG[tipo], 'utf8');
        }
    });
}
