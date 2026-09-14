import { Request } from 'express';

export interface AuthUser {
    id: number;
    username: string;
}

export function getAuthUser(req: Request): AuthUser | null {
    const user = (req as Request & { user?: AuthUser }).user;
    if (!user || !user.id) {
        return null;
    }
    return user;
}
