export const MENSAJE_UNIDAD_MEDIDA = 'Ingresa una unidad de medida válida, por ejemplo: Unidad, Fanega o Quintal';

/** Letras (con acentos), números y espacios. Debe incluir al menos una letra. */
const REGEX_UNIDAD = /^(?=.*[A-Za-zÁÉÍÓÚÜÑáéíóúüñ])[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 ]+$/;

export function esUnidadMedidaValida(valor: unknown): boolean {
    const texto = String(valor ?? '').trim();
    if (!texto) {
        return false;
    }
    return REGEX_UNIDAD.test(texto);
}

export function unidadMedidaInvalida(valor: unknown): boolean {
    const texto = String(valor ?? '').trim();
    return Boolean(texto) && !esUnidadMedidaValida(texto);
}
