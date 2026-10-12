import { Request } from 'express';

export interface AuthUser {
    id: number;
    username: string;
}

export const USUARIO_ATRIBUTOS = ['id', 'username', 'nombre'] as const;

export function getAuthUser(req: Request): AuthUser | null {
    const user = (req as Request & { user?: AuthUser }).user;
    if (!user || !user.id) {
        return null;
    }
    return user;
}

type UsuarioNombre = { nombre?: string | null; username?: string | null } | null | undefined;

export function nombreVisible(...usuarios: UsuarioNombre[]): string {
    for (const usuario of usuarios) {
        const nombre = String(usuario?.nombre || '').trim() || String(usuario?.username || '').trim();
        if (nombre) {
            return nombre;
        }
    }
    return '-';
}

export function mapUsuarioResumen(usuario?: { id?: number; username?: string; nombre?: string | null } | null) {
    if (!usuario?.id) {
        return null;
    }
    return {
        id: usuario.id,
        username: usuario.username,
        nombre: usuario.nombre || null
    };
}
