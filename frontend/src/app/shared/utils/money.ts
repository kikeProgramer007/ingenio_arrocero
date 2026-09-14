export function toMoney(value: unknown): number {
    const n = typeof value === 'string' ? parseFloat(value) : Number(value ?? 0);
    if (!Number.isFinite(n)) {
        return 0;
    }
    return Math.round(n * 100) / 100;
}

export function roundMoney(value: number): number {
    return Math.round(toMoney(value) * 100) / 100;
}

export function formatBs(value: unknown): string {
    const safe = toMoney(value);
    return `Bs ${safe.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
