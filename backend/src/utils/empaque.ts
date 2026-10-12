export function esNombreEmpaque(valor: unknown): boolean {
    const texto = String(valor ?? '').toLowerCase();
    return texto.includes('empaque') || texto.includes('bolsa') || texto.includes('arpillera');
}

export function esProductoEmpaque(producto: { nombre?: unknown; categoria?: { nombre?: unknown } | null } | null | undefined): boolean {
    if (!producto) {
        return false;
    }
    return esNombreEmpaque(producto.categoria?.nombre) || esNombreEmpaque(producto.nombre);
}
