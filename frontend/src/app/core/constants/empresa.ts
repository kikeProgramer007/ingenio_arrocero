export type FormatoNota = '11' | '5.5';

export interface Empresa {
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
}

export const FORMATOS_NOTA: { label: string; value: FormatoNota }[] = [
    { label: '9½ × 11" (formulario largo)', value: '11' },
    { label: '9½ × 5½" (formulario corto)', value: '5.5' }
];

export const EMPRESA_FALLBACK: Empresa = {
    id: 0,
    nombre: 'Comercial Demo',
    nombre_corto: 'Empresa Demo',
    slogan: 'Sistema de gestión comercial',
    titular: '',
    nit: '',
    direccion: '',
    telefono: '',
    ciudad: '',
    email: '',
    path_logo: 'assets/brand/logotipo.jpeg',
    formato_nota: '11',
    tipo_cambio: 9.96
};

/** Respaldo estático si la API aún no respondió. */
export const EMPRESA = {
    nombre: EMPRESA_FALLBACK.nombre_corto,
    slogan: EMPRESA_FALLBACK.slogan,
    logo: EMPRESA_FALLBACK.path_logo
} as const;
