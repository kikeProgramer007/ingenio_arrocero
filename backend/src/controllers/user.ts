import { Request, Response} from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User, Perfil, Programas } from '../models';
import { AuthResponseMapper } from '../mapper/usuario/auth.response.mapper';
import { getJwtSecret } from '../utils/jwt';

const mapper = new AuthResponseMapper();
export const newUser = async (req: Request, res: Response) => {
    try {
        const { username, password, id_perfil } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                mensaje: 'Username y password son obligatorios'
            });
        }

        const user = await User.findOne({ where: { username: username } });

        if (user) {
            return res.status(400).json({
                mensaje: `Ya existe un usuario con el nombre ${username}`
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await User.create({
            username: username,
            password: hashedPassword,
            id_perfil: id_perfil
        });

        return res.json({
            mensaje: `Usuario ${username} creado exitosamente!`
        });
    } catch (error) {
        return res.status(400).json({
            mensaje: 'Upps ocurrio un error',
            error
        });
    }
}

export const loginUser = async (req: Request, res: Response) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                mensaje: 'Username y password son obligatorios'
            });
        }

        const userObj: any = await User.findOne({ where: { username } });

        if (!userObj) {
            return res.status(403).json({
                mensaje: `No existe un usuario con el nombre ${username} en la base datos`
            });
        }

        const passwordValid = await bcrypt.compare(password, userObj.password);
        if (!passwordValid) {
            return res.status(403).json({
                mensaje: 'Password Incorrecta'
            });
        }

        const token = jwt.sign({
            id: userObj.id,
            username: username
        }, getJwtSecret());

        let userWithRelations: any = userObj;
        try {
            const fullUser: any = await User.findOne({
                where: { username },
                include: [
                    {
                        model: Perfil,
                        include: [
                            {
                                model: Programas,
                                where: { eliminado: false },
                                required: false,
                                through: {
                                    attributes: [
                                        'permiso_lectura',
                                        'permiso_escritura',
                                        'permiso_modificacion'
                                    ]
                                }
                            }
                        ]
                    }
                ]
            });
            if (fullUser) {
                userWithRelations = fullUser;
            }
        } catch (includeError) {
            console.error('No se pudieron cargar perfil/programas en login:', includeError);
        }

        const user = mapper.map(userWithRelations);
        return res.json({ token, user });
    } catch (error) {
        console.error('Error en login:', error);
        return res.status(500).json({
            mensaje: 'Error al iniciar sesión',
            error: error instanceof Error ? error.message : error
        });
    }
}