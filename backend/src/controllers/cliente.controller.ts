import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Cliente } from '../models';
import { handleError } from '../utils/error.handler';
import { DtoValidator } from '../utils/dto.validador';
import { ActualizarClienteDTO, CrearClienteDTO } from '../dtos/cliente.dto';
import { imagenParaGuardar, resolverImagen } from '../utils/imagen';

function mapCliente(cliente: any) {
    return {
        id: cliente.id,
        nombre: cliente.nombre,
        nit_ci: cliente.nit_ci,
        telefono: cliente.telefono,
        direccion: cliente.direccion,
        observacion: cliente.observacion,
        activo: cliente.activo,
        path_imagen: resolverImagen(cliente.path_imagen, 'cliente'),
        created_at: cliente.created_at,
        updated_at: cliente.updated_at
    };
}

export class ClienteController {
    public static async listar(req: Request, res: Response): Promise<void> {
        try {
            const { q, activos } = req.query;
            const where: any = {};
            if (activos !== 'todos') {
                where.activo = true;
            }
            if (typeof q === 'string' && q.trim()) {
                where[Op.or] = [
                    { nombre: { [Op.like]: `%${q.trim()}%` } },
                    { nit_ci: { [Op.like]: `%${q.trim()}%` } }
                ];
            }
            const clientes = await Cliente.findAll({
                where,
                order: [['nombre', 'ASC']]
            });
            res.status(200).json(clientes.map(mapCliente));
        } catch (error) {
            handleError(res, error, 'Error al listar clientes');
        }
    }

    public static async obtener(req: Request, res: Response): Promise<void> {
        try {
            const cliente = await Cliente.findByPk(req.params.id);
            if (!cliente) {
                res.status(404).json({ mensaje: `No se encontró el cliente con ID ${req.params.id}` });
                return;
            }
            res.status(200).json(mapCliente(cliente));
        } catch (error) {
            handleError(res, error, 'Error al obtener el cliente');
        }
    }

    public static async crear(req: Request, res: Response): Promise<void> {
        const datos = await DtoValidator.validateAndRespond(CrearClienteDTO, req.body, res);
        if (!datos) {
            return;
        }
        try {
            const cliente = await Cliente.create({
                nombre: datos.nombre.trim(),
                nit_ci: datos.nit_ci?.trim() || null,
                telefono: datos.telefono?.trim() || null,
                direccion: datos.direccion?.trim() || null,
                observacion: datos.observacion?.trim() || null,
                activo: datos.activo !== false,
                path_imagen: imagenParaGuardar(datos.path_imagen, 'cliente')
            });
            res.status(201).json({ mensaje: 'Cliente creado', data: mapCliente(cliente) });
        } catch (error) {
            handleError(res, error, 'Error al crear el cliente');
        }
    }

    public static async actualizar(req: Request, res: Response): Promise<void> {
        const datos = await DtoValidator.validateAndRespond(ActualizarClienteDTO, req.body, res);
        if (!datos) {
            return;
        }
        try {
            const cliente = await Cliente.findByPk(req.params.id);
            if (!cliente) {
                res.status(404).json({ mensaje: `No se encontró el cliente con ID ${req.params.id}` });
                return;
            }
            await cliente.update({
                nombre: datos.nombre.trim(),
                nit_ci: datos.nit_ci?.trim() || null,
                telefono: datos.telefono?.trim() || null,
                direccion: datos.direccion?.trim() || null,
                observacion: datos.observacion?.trim() || null,
                activo: datos.activo ?? cliente.get('activo'),
                path_imagen: imagenParaGuardar(datos.path_imagen ?? (cliente.get('path_imagen') as string), 'cliente')
            });
            res.status(200).json({ mensaje: 'Cliente actualizado', data: mapCliente(cliente) });
        } catch (error) {
            handleError(res, error, 'Error al actualizar el cliente');
        }
    }
}
