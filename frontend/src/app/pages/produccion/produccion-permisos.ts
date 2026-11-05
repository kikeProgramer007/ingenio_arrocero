import { STORAGE_KEYS } from '../../core/constants/storage-keys';

export function permisoDescarguio(campo: 'lectura' | 'escritura' | 'modificacion'): boolean {
    return permisoEtapa('descarguios',campo);
}
export function permisoEtapa(ruta: string, campo: 'lectura' | 'escritura' | 'modificacion'): boolean {
    try {
        const programas = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER_MENU) || '[]') as { url: string; permisos?: Record<string, boolean> }[];
        return programas.some(p => p.url === '/produccion/'+ruta && p.permisos?.[campo] === true);
    } catch { return false; }
}
