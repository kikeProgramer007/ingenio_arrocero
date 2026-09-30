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
}

export const EMPRESA_FALLBACK: Empresa = {
    id: 0,
    nombre: 'Ingenio Arrocero Royal',
    nombre_corto: 'Royal Alimentos',
    slogan: 'Ingenio arrocero',
    titular: '',
    nit: '',
    direccion: '',
    telefono: '',
    ciudad: '',
    email: '',
    path_logo: 'assets/brand/logotipo.jpeg'
};

/** Respaldo estático si la API aún no respondió. */
export const EMPRESA = {
    nombre: EMPRESA_FALLBACK.nombre_corto,
    slogan: EMPRESA_FALLBACK.slogan,
    logo: EMPRESA_FALLBACK.path_logo
} as const;
