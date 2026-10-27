import { Op } from 'sequelize';

export function valoresQuery(query: Record<string, unknown> | object, key: string): string[] {
    const raw = (query as Record<string, unknown>)[key];
    if (raw == null || raw === '') {
        return [];
    }
    const lista = Array.isArray(raw) ? raw : String(raw).split(',');
    return [...new Set(lista.map((v) => String(v).trim()).filter(Boolean))];
}

export function idsQuery(query: Record<string, unknown> | object, key: string): number[] {
    return valoresQuery(query, key)
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0);
}

export function aplicarFiltroIn(where: Record<string, unknown>, campo: string, valores: Array<string | number>): void {
    if (!valores.length) {
        return;
    }
    where[campo] = valores.length === 1 ? valores[0] : { [Op.in]: valores };
}
