import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Proveedor } from '../models';
import { handleError } from '../utils/error.handler';
import { DtoValidator } from '../utils/dto.validador';
import { ActualizarProveedorDTO, CrearProveedorDTO } from '../dtos/proveedor.dto';
import { imagenParaGuardar, resolverImagen } from '../utils/imagen';

function mapProveedor(proveedor: any) {
    return {
        id: proveedor.id,
        nombre: proveedor.nombre,
        nit_ci: proveedor.nit_ci,
        telefono: proveedor.telefono,
        direccion: proveedor.direccion,
        observacion: proveedor.observacion,
        activo: proveedor.activo,
        path_imagen: resolverImagen(proveedor.path_imagen, 'proveedor'),
        created_at: proveedor.created_at,
        updated_at: proveedor.updated_at
    };
}

export class ProveedorController {
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
            const proveedores = await Proveedor.findAll({
                where,
                order: [['nombre', 'ASC']]
            });
            res.status(200).json(proveedores.map(mapProveedor));
        } catch (error) {
            handleError(res, error, 'Error al listar proveedores');
        }
    }

    public static async obtener(req: Request, res: Response): Promise<void> {
        try {
            const proveedor = await Proveedor.findByPk(req.params.id);
            if (!proveedor) {
                res.status(404).json({ mensaje: `No se encontró el proveedor con ID ${req.params.id}` });
                return;
            }
            res.status(200).json(mapProveedor(proveedor));
        } catch (error) {
            handleError(res, error, 'Error al obtener el proveedor');
        }
    }

    public static async crear(req: Request, res: Response): Promise<void> {
        const datos = await DtoValidator.validateAndRespond(CrearProveedorDTO, req.body, res);
        if (!datos) {
            return;
        }
        try {
            const proveedor = await Proveedor.create({
                nombre: datos.nombre.trim(),
                nit_ci: datos.nit_ci?.trim() || null,
                telefono: datos.telefono?.trim() || null,
                direccion: datos.direccion?.trim() || null,
                observacion: datos.observacion?.trim() || null,
                activo: datos.activo !== false,
                path_imagen: imagenParaGuardar(datos.path_imagen, 'proveedor')
            });
            res.status(201).json({ mensaje: 'Proveedor creado', data: mapProveedor(proveedor) });
        } catch (error) {
            handleError(res, error, 'Error al crear el proveedor');
        }
    }

    public static async actualizar(req: Request, res: Response): Promise<void> {
        const datos = await DtoValidator.validateAndRespond(ActualizarProveedorDTO, req.body, res);
        if (!datos) {
            return;
        }
        try {
            const proveedor = await Proveedor.findByPk(req.params.id);
            if (!proveedor) {
                res.status(404).json({ mensaje: `No se encontró el proveedor con ID ${req.params.id}` });
                return;
            }
            await proveedor.update({
                nombre: datos.nombre.trim(),
                nit_ci: datos.nit_ci?.trim() || null,
                telefono: datos.telefono?.trim() || null,
                direccion: datos.direccion?.trim() || null,
                observacion: datos.observacion?.trim() || null,
                activo: datos.activo ?? proveedor.get('activo'),
                path_imagen: imagenParaGuardar(datos.path_imagen ?? (proveedor.get('path_imagen') as string), 'proveedor')
            });
            res.status(200).json({ mensaje: 'Proveedor actualizado', data: mapProveedor(proveedor) });
        } catch (error) {
            handleError(res, error, 'Error al actualizar el proveedor');
        }
    }
}
