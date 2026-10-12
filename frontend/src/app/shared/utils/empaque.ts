export function esNombreEmpaque(valor?: string | null): boolean {
    const texto = (valor || '').toLowerCase();
    return texto.includes('empaque') || texto.includes('bolsa') || texto.includes('arpillera');
}

export function esProductoEmpaque(producto: { nombre?: string | null; categoria?: { nombre?: string | null } | null }): boolean {
    return esNombreEmpaque(producto.categoria?.nombre) || esNombreEmpaque(producto.nombre);
}
