export const VERSION_PRODUCCION = '20261105-produccion-base';

export const PROGRAMAS_PRODUCCION = [
    { nombre_programa: 'Producción', url: '/produccion', class_icon: 'pi pi-cog', es_expandible: true, nro_posicion: 63 },
    { nombre_programa: 'Resumen', url: '/produccion/resumen', class_icon: 'pi pi-chart-bar', es_expandible: false, nro_posicion: 64 },
    { nombre_programa: 'Descarguíos', url: '/produccion/descarguios', class_icon: 'pi pi-download', es_expandible: false, nro_posicion: 65 },
    { nombre_programa: 'Secados', url: '/produccion/secados', class_icon: 'pi pi-sun', es_expandible: false, nro_posicion: 66 },
    { nombre_programa: 'Guardados', url: '/produccion/guardados', class_icon: 'pi pi-warehouse', es_expandible: false, nro_posicion: 67 },
    { nombre_programa: 'Procesados', url: '/produccion/procesados', class_icon: 'pi pi-cog', es_expandible: false, nro_posicion: 68 },
    { nombre_programa: 'Envasados', url: '/produccion/envasados', class_icon: 'pi pi-box', es_expandible: false, nro_posicion: 69 },
    { nombre_programa: 'Lotes y trazabilidad', url: '/produccion/lotes', class_icon: 'pi pi-sitemap', es_expandible: false, nro_posicion: 70 }
];

export function esProgramaProduccion(url: string): boolean {
    return PROGRAMAS_PRODUCCION.some(p => p.url === url);
}

/** Acceso inicial solo a administradores; los permisos existentes se respetan. */
export function permisosInicialesProduccion(nombrePerfil: unknown) {
    const administrador = ['administrador', 'admin'].includes(String(nombrePerfil).trim().toLowerCase());
    return { permiso_lectura: administrador, permiso_escritura: administrador, permiso_modificacion: administrador };
}
