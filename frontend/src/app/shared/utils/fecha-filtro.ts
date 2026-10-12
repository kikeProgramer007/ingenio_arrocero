export function ymdLocal(fecha?: Date | null): string | undefined {
    if (!fecha) {
        return undefined;
    }
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function ymdDesdeRango(rango?: Date[] | null): string | undefined {
    return ymdLocal(rango?.[0] || null);
}

export function ymdHastaRango(rango?: Date[] | null): string | undefined {
    return ymdLocal(rango?.[1] || rango?.[0] || null);
}

export const METODOS_DOCUMENTO_FILTRO = [
    { label: 'Efectivo', value: 'EFECTIVO' },
    { label: 'QR', value: 'QR' },
    { label: 'Mixto', value: 'MIXTO' }
];

export const ESTADOS_ACTIVO_FILTRO = [
    { label: 'Todos', value: 'todos' },
    { label: 'Activos', value: 'activos' },
    { label: 'Inactivos', value: 'inactivos' }
];
