export function inicioFinDia(fecha = new Date()): { inicio: Date; fin: Date } {
    const inicio = new Date(fecha);
    inicio.setHours(0, 0, 0, 0);
    const fin = new Date(fecha);
    fin.setHours(23, 59, 59, 999);
    return { inicio, fin };
}

export function inicioFinMes(fecha = new Date()): { inicio: Date; fin: Date } {
    const inicio = new Date(fecha.getFullYear(), fecha.getMonth(), 1, 0, 0, 0, 0);
    const fin = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0, 23, 59, 59, 999);
    return { inicio, fin };
}

export function parseFechaLocal(valor: string): Date {
    const partes = valor.slice(0, 10).split('-').map(Number);
    const anio = partes[0];
    const mes = partes[1];
    const dia = partes[2];
    if (!anio || !mes || !dia) {
        return new Date(NaN);
    }
    return new Date(anio, mes - 1, dia);
}

export function inicioDia(fecha = new Date()): Date {
    const inicio = new Date(fecha);
    inicio.setHours(0, 0, 0, 0);
    return inicio;
}

export function ymdLocal(fecha = new Date()): string {
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function agregarDias(fecha: Date, dias: number): Date {
    const copia = inicioDia(fecha);
    copia.setDate(copia.getDate() + dias);
    return copia;
}

export function diasEntre(desde: Date, hasta: Date): number {
    const a = inicioDia(desde).getTime();
    const b = inicioDia(hasta).getTime();
    return Math.round((b - a) / 86400000);
}

export function fechaComoDia(valor: unknown): Date | null {
    if (!valor) {
        return null;
    }
    if (typeof valor === 'string') {
        const parsed = parseFechaLocal(valor);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
        return new Date(valor.getUTCFullYear(), valor.getUTCMonth(), valor.getUTCDate());
    }
    return null;
}

export function rangoDesdeQuery(desde?: unknown, hasta?: unknown): { inicio: Date; fin: Date } {
    if (typeof desde === 'string' && desde && typeof hasta === 'string' && hasta) {
        const inicio = parseFechaLocal(desde);
        inicio.setHours(0, 0, 0, 0);
        const fin = parseFechaLocal(hasta);
        fin.setHours(23, 59, 59, 999);
        if (!Number.isNaN(inicio.getTime()) && !Number.isNaN(fin.getTime())) {
            return { inicio, fin };
        }
    }
    return inicioFinMes();
}
