export const CATEGORIAS_GASTO_EMPRESA = [
    'Combustible',
    'Transporte',
    'Energía',
    'Mantenimiento',
    'Repuestos',
    'Servicios',
    'Alimentación',
    'Otros'
] as const;

export type CategoriaGastoEmpresa = (typeof CATEGORIAS_GASTO_EMPRESA)[number];
