export const MENSAJE_UNIDAD_MEDIDA = 'Ingresa una unidad de medida válida, por ejemplo: Unidad, Fanega o Quintal';

const REGEX_UNIDAD = /^(?=.*[A-Za-zÁÉÍÓÚÜÑáéíóúüñ])[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 ]+$/;

export function esUnidadMedidaValida(valor: unknown): boolean {
    const texto = String(valor ?? '').trim();
    if (!texto) {
        return false;
    }
    return REGEX_UNIDAD.test(texto);
}
