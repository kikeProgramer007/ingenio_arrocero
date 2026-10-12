import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Compra, Productor, Proveedor } from '../models';
import { handleError } from '../utils/error.handler';
import { DtoValidator } from '../utils/dto.validador';
import { ActualizarProductorDTO, CrearProductorDTO } from '../dtos/productor.dto';
import { imagenParaGuardar, resolverImagen } from '../utils/imagen';

function mapProductor(item: any) {
    const proveedor = item.proveedor;
    return {
        id: item.id,
        id_proveedor: item.id_proveedor || null,
        nombre: item.nombre,
        nit_ci: item.nit_ci,
        telefono: item.telefono,
        direccion: item.direccion,
        observacion: item.observacion,
        activo: item.activo,
        path_imagen: resolverImagen(item.path_imagen, 'proveedor'),
        proveedor: proveedor ? { id: proveedor.id, nombre: proveedor.nombre } : null,
        created_at: item.created_at,
        updated_at: item.updated_at
    };
}

const includeProveedor = { model: Proveedor, as: 'proveedor', attributes: ['id', 'nombre'] };

async function validarProveedor(idProveedor: number): Promise<string | null> {
    const proveedor = await Proveedor.findByPk(idProveedor);
    if (!proveedor || !proveedor.get('activo')) {
        return 'El proveedor no existe o está inactivo';
    }
    return null;
}

export class ProductorController {
    public static async listar(req: Request, res: Response): Promise<void> {
        try {
            const { q, activos, id_proveedor, libres } = req.query;
            const where: any = {};
            if (activos === 'inactivos') {
                where.activo = false;
            } else if (activos !== 'todos') {
                where.activo = true;
            }
            const idProveedor = Number(id_proveedor);
            if (Number.isFinite(idProveedor) && idProveedor > 0) {
                if (libres === '1' || libres === 'true') {
                    where[Op.or] = [{ id_proveedor: idProveedor }, { id_proveedor: null }];
                } else {
                    where.id_proveedor = idProveedor;
                }
            }
            if (typeof q === 'string' && q.trim()) {
                const busqueda = {
                    [Op.or]: [
                        { nombre: { [Op.like]: `%${q.trim()}%` } },
                        { nit_ci: { [Op.like]: `%${q.trim()}%` } }
                    ]
                };
                where[Op.and] = [...(where[Op.and] || []), busqueda];
            }
            const items = await Productor.findAll({
                where,
                include: [includeProveedor],
                order: [['nombre', 'ASC']]
            });
            res.status(200).json(items.map(mapProductor));
        } catch (error) {
            handleError(res, error, 'Error al listar productores');
        }
    }

    public static async obtener(req: Request, res: Response): Promise<void> {
        try {
            const item = await Productor.findByPk(req.params.id, { include: [includeProveedor] });
            if (!item) {
                res.status(404).json({ mensaje: `No se encontró el productor con ID ${req.params.id}` });
                return;
            }
            res.status(200).json(mapProductor(item));
        } catch (error) {
            handleError(res, error, 'Error al obtener el productor');
        }
    }

    public static async crear(req: Request, res: Response): Promise<void> {
        try {
            const datos = await DtoValidator.validateAndRespond(CrearProductorDTO, req.body, res);
            if (!datos) {
                return;
            }
            const errorProveedor = await validarProveedor(Number(datos.id_proveedor));
            if (errorProveedor) {
                res.status(400).json({ mensaje: errorProveedor });
                return;
            }
            const creado = await Productor.create({
                id_proveedor: Number(datos.id_proveedor),
                nombre: datos.nombre.trim(),
                nit_ci: datos.nit_ci || null,
                telefono: datos.telefono || null,
                direccion: datos.direccion || null,
                observacion: datos.observacion || null,
                activo: datos.activo !== false,
                path_imagen: imagenParaGuardar(datos.path_imagen, 'proveedor')
            });
            const completo = await Productor.findByPk(creado.get('id') as number, { include: [includeProveedor] });
            res.status(201).json({ mensaje: 'Productor registrado', data: mapProductor(completo || creado) });
        } catch (error) {
            handleError(res, error, 'Error al registrar el productor');
        }
    }

    public static async actualizar(req: Request, res: Response): Promise<void> {
        try {
            const datos = await DtoValidator.validateAndRespond(ActualizarProductorDTO, req.body, res);
            if (!datos) {
                return;
            }
            const item = await Productor.findByPk(req.params.id);
            if (!item) {
                res.status(404).json({ mensaje: `No se encontró el productor con ID ${req.params.id}` });
                return;
            }
            const errorProveedor = await validarProveedor(Number(datos.id_proveedor));
            if (errorProveedor) {
                res.status(400).json({ mensaje: errorProveedor });
                return;
            }
            await item.update({
                id_proveedor: Number(datos.id_proveedor),
                nombre: datos.nombre.trim(),
                nit_ci: datos.nit_ci || null,
                telefono: datos.telefono || null,
                direccion: datos.direccion || null,
                observacion: datos.observacion || null,
                activo: datos.activo !== false,
                path_imagen: imagenParaGuardar(datos.path_imagen ?? (item.get('path_imagen') as string), 'proveedor')
            });
            const completo = await Productor.findByPk(item.get('id') as number, { include: [includeProveedor] });
            res.status(200).json({ mensaje: 'Productor actualizado', data: mapProductor(completo || item) });
        } catch (error) {
            handleError(res, error, 'Error al actualizar el productor');
        }
    }

    public static async eliminar(req: Request, res: Response): Promise<void> {
        try {
            const item = await Productor.findByPk(req.params.id);
            if (!item) {
                res.status(404).json({ mensaje: `No se encontró el productor con ID ${req.params.id}` });
                return;
            }
            const usados = await Compra.count({ where: { id_productor: item.get('id') } });
            if (usados > 0) {
                res.status(409).json({
                    mensaje: 'No se puede eliminar: el productor ya tiene compras. Puede inactivarlo.'
                });
                return;
            }
            await item.destroy();
            res.status(200).json({ mensaje: 'Productor eliminado' });
        } catch (error) {
            handleError(res, error, 'Error al eliminar el productor');
        }
    }
}
