import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { User, Perfil, Programas } from '../models';
import { AuthResponseMapper } from '../mapper/usuario/auth.response.mapper';
import { getJwtSecret } from '../utils/jwt';
import { handleError } from '../utils/error.handler';
import { DtoValidator } from '../utils/dto.validador';
import { ActualizarUsuarioDTO, CrearUsuarioDTO } from '../dtos/usuario.dto';
import { getAuthUser } from '../utils/auth-user';

const mapper = new AuthResponseMapper();

const includePerfil = {
    model: Perfil,
    attributes: ['id', 'nombre'],
    required: false
};

function texto(valor?: string | null): string | null {
    const t = String(valor || '').trim();
    return t || null;
}

function mapUsuario(u: any) {
    const perfil = u.perfil || u.Perfil;
    return {
        id: u.id,
        username: u.username,
        nombre: u.nombre || '',
        ci: u.ci || '',
        telefono: u.telefono || '',
        email: u.email || '',
        cargo: u.cargo || '',
        activo: u.activo !== false,
        id_perfil: u.id_perfil,
        perfil: perfil ? { id: perfil.id, nombre: perfil.nombre } : null,
        createdAt: u.createdAt
    };
}

async function perfilValido(idPerfil: number) {
    const perfil = await Perfil.findByPk(idPerfil);
    if (!perfil || perfil.get('eliminado')) {
        return null;
    }
    return perfil;
}

async function usernameOcupado(username: string, excluirId?: number) {
    const where: any = { username, eliminado: false };
    if (excluirId) {
        where.id = { [Op.ne]: excluirId };
    }
    return User.findOne({ where });
}

export const listarUsuarios = async (req: Request, res: Response) => {
    try {
        const { q, activos } = req.query;
        const where: any = { eliminado: false };
        if (activos === 'inactivos') {
            where.activo = false;
        } else if (activos !== 'todos') {
            where.activo = true;
        }
        if (typeof q === 'string' && q.trim()) {
            const like = { [Op.like]: `%${q.trim()}%` };
            where[Op.or] = [
                { username: like },
                { nombre: like },
                { ci: like },
                { cargo: like }
            ];
        }
        const usuarios = await User.findAll({
            where,
            attributes: { exclude: ['password'] },
            include: [includePerfil],
            order: [['nombre', 'ASC'], ['username', 'ASC']]
        });
        res.status(200).json(usuarios.map(mapUsuario));
    } catch (error) {
        handleError(res, error, 'Error al listar usuarios');
    }
};

export const listarPerfiles = async (_req: Request, res: Response) => {
    try {
        const perfiles = await Perfil.findAll({
            where: { eliminado: false },
            attributes: ['id', 'nombre'],
            order: [['nombre', 'ASC']]
        });
        res.status(200).json(perfiles);
    } catch (error) {
        handleError(res, error, 'Error al listar perfiles');
    }
};

export const crearUsuario = async (req: Request, res: Response) => {
    const datos = await DtoValidator.validateAndRespond(CrearUsuarioDTO, req.body, res);
    if (!datos) {
        return;
    }
    try {
        const username = datos.username.trim();
        if (await usernameOcupado(username)) {
            res.status(400).json({ mensaje: `Ya existe un usuario con el nombre ${username}` });
            return;
        }
        const perfil = await perfilValido(datos.id_perfil);
        if (!perfil) {
            res.status(400).json({ mensaje: 'El perfil seleccionado no existe' });
            return;
        }
        const hashedPassword = await bcrypt.hash(datos.password, 10);
        const creado = await User.create({
            username,
            password: hashedPassword,
            nombre: datos.nombre.trim(),
            ci: texto(datos.ci),
            telefono: texto(datos.telefono),
            email: texto(datos.email),
            cargo: texto(datos.cargo),
            id_perfil: datos.id_perfil,
            activo: datos.activo !== false,
            eliminado: false
        });
        const usuario = await User.findByPk(creado.get('id') as number, {
            attributes: { exclude: ['password'] },
            include: [includePerfil]
        });
        res.status(201).json({ mensaje: `Usuario ${username} creado`, data: mapUsuario(usuario) });
    } catch (error) {
        handleError(res, error, 'Error al crear el usuario');
    }
};

export const actualizarUsuario = async (req: Request, res: Response) => {
    const datos = await DtoValidator.validateAndRespond(ActualizarUsuarioDTO, req.body, res);
    if (!datos) {
        return;
    }
    try {
        const usuario = await User.findByPk(req.params.id);
        if (!usuario || usuario.get('eliminado')) {
            res.status(404).json({ mensaje: `No se encontró el usuario con ID ${req.params.id}` });
            return;
        }
        const auth = getAuthUser(req);
        if (auth?.id === Number(usuario.get('id')) && datos.activo === false) {
            res.status(400).json({ mensaje: 'No puedes inactivar tu propio usuario' });
            return;
        }
        const username = datos.username.trim();
        if (await usernameOcupado(username, Number(usuario.get('id')))) {
            res.status(400).json({ mensaje: `Ya existe un usuario con el nombre ${username}` });
            return;
        }
        const perfil = await perfilValido(datos.id_perfil);
        if (!perfil) {
            res.status(400).json({ mensaje: 'El perfil seleccionado no existe' });
            return;
        }
        const cambios: Record<string, unknown> = {
            username,
            nombre: datos.nombre.trim(),
            ci: texto(datos.ci),
            telefono: texto(datos.telefono),
            email: texto(datos.email),
            cargo: texto(datos.cargo),
            id_perfil: datos.id_perfil,
            activo: datos.activo !== false
        };
        if (datos.password) {
            cambios.password = await bcrypt.hash(datos.password, 10);
        }
        await usuario.update(cambios);
        const actualizado = await User.findByPk(usuario.get('id') as number, {
            attributes: { exclude: ['password'] },
            include: [includePerfil]
        });
        res.status(200).json({ mensaje: 'Usuario actualizado', data: mapUsuario(actualizado) });
    } catch (error) {
        handleError(res, error, 'Error al actualizar el usuario');
    }
};

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

        if (userObj.eliminado || userObj.activo === false) {
            return res.status(403).json({
                mensaje: 'El usuario está inactivo. Consulta con el administrador.'
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
};
