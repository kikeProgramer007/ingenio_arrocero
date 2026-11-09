/** Values stay bound through Sequelize replacements, never interpolated into SQL. */
export function valoresFiltro(valor: unknown, permitidos?: readonly string[]): string[] {
    if (valor == null || valor === '') return [];
    const entradas = Array.isArray(valor) ? valor : String(valor).split(',');
    if (entradas.length > 200) throw Object.assign(new Error('Seleccione hasta 200 valores por filtro.'), { status: 400 });
    const valores = [...new Set(entradas.map(v => String(v).trim()).filter(Boolean))];
    if (valores.some(v => v.length > 150 || permitidos && !permitidos.includes(v)))
        throw Object.assign(new Error('Valor de filtro inválido.'), { status: 400 });
    return valores;
}
export function idsFiltro(valor: unknown): number[] {
    const valores = valoresFiltro(valor);
    if (valores.some(v => !/^\d+$/.test(v) || !Number.isSafeInteger(Number(v)) || Number(v) < 1 || Number(v) > 2147483647))
        throw Object.assign(new Error('Identificador de filtro inválido.'), { status: 400 });
    return valores.map(Number);
}
