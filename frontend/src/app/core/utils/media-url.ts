import { apiUrl } from './api-url';

export type TipoImagen = 'producto' | 'cliente' | 'proveedor';

const DEFAULTS: Record<TipoImagen, string> = {
    producto: '/uploads/defaults/producto.svg',
    cliente: '/uploads/defaults/cliente.svg',
    proveedor: '/uploads/defaults/proveedor.svg'
};

export function mediaUrl(path?: string | null, tipo: TipoImagen = 'producto'): string {
    const fallback = DEFAULTS[tipo];
    const valor = (path || '').trim() || fallback;
    if (valor.startsWith('http') || valor.startsWith('blob:') || valor.startsWith('data:')) {
        return valor;
    }
    return apiUrl(valor);
}

export function imagenDefault(tipo: TipoImagen): string {
    return DEFAULTS[tipo];
}
