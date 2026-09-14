import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../utils/jwt';
import { AuthUser } from '../utils/auth-user';

const validateToken = (req: Request, res: Response, next: NextFunction) => {
    const headerToken = req.headers['authorization'];

    if (headerToken != undefined && headerToken.startsWith('Bearer ')) {
        try {
            const bearerToken = headerToken.slice(7);
            const decoded = jwt.verify(bearerToken, getJwtSecret()) as AuthUser & { iat?: number };
            if (!decoded?.id) {
                res.status(401).json({
                    msg: 'token no valido'
                });
                return;
            }
            (req as Request & { user: AuthUser }).user = {
                id: Number(decoded.id),
                username: decoded.username
            };
            next();
        } catch (error) {
            res.status(401).json({
                msg: 'token no valido'
            });
        }
    } else {
        res.status(401).json({
            msg: 'Acceso denegado'
        });
    }
};

export default validateToken;
