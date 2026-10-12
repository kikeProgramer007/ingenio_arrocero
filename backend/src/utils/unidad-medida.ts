export const MENSAJE_UNIDAD_MEDIDA = 'Elegí una unidad de medida: Kilo, Fanega, Quintal o Unidad.';

export const UNIDADES_MEDIDA = ['Kilo', 'Fanega', 'Quintal', 'Unidad'] as const;

const ALIAS: Record<string, string> = {
    kg: 'Kilo',
    kilo: 'Kilo',
    kilos: 'Kilo',
    fanega: 'Fanega',
    fanegas: 'Fanega',
    qq: 'Quintal',
    quintal: 'Quintal',
    quintales: 'Quintal',
    unidad: 'Unidad',
    unidades: 'Unidad',
    und: 'Unidad'
};

export function normalizarUnidadMedida(valor: unknown): string {
    const texto = String(valor ?? '').trim();
    if (!texto) {
        return '';
    }
    return ALIAS[texto.toLowerCase()] || texto;
}

export function esUnidadMedidaValida(valor: unknown): boolean {
    const texto = normalizarUnidadMedida(valor);
    return (UNIDADES_MEDIDA as readonly string[]).includes(texto);
}

export function unidadMedidaInvalida(valor: unknown): boolean {
    const texto = String(valor ?? '').trim();
    return Boolean(texto) && !esUnidadMedidaValida(texto);
}
