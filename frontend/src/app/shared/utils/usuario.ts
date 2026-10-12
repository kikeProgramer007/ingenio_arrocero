export function nombreUsuario(u?: { nombre?: string | null; username?: string | null } | null): string {
    const nombre = String(u?.nombre || '').trim();
    return nombre || u?.username || '-';
}
