import { Request, Response } from 'express';
import { Productos, Produccion, sequelize, User } from '../models';
import { aplicarFiltroFecha } from '../utils/fecha';
import { handleError } from '../utils/error.handler';
import { DtoValidator } from '../utils/dto.validador';
import { getAuthUser, mapUsuarioResumen } from '../utils/auth-user';
import { aplicarStock, TIPO_INVENTARIO, toQty } from '../utils/inventario';
import { CrearProduccionDTO } from '../dtos/campana.dto';

function mapProduccion(item: any) {
    return {
        id: item.id,
        fecha: item.fecha,
        cantidad_entrada: toQty(item.cantidad_entrada),
        cantidad_salida: toQty(item.cantidad_salida),
        merma: toQty(item.merma),
        observacion: item.observacion,
        producto_origen: item.productoOrigen ? { id: item.productoOrigen.id, nombre: item.productoOrigen.nombre } : null,
        producto_destino: item.productoDestino ? { id: item.productoDestino.id, nombre: item.productoDestino.nombre } : null,
        usuario: mapUsuarioResumen(item.usuario)
    };
}

export class ProduccionController {
    public static async listar(req: Request, res: Response): Promise<void> {
        try {
            const where: any = {};
            aplicarFiltroFecha(where, req.query);
            const items = await Produccion.findAll({
                where,
                include: [
                    { model: Productos, as: 'productoOrigen', attributes: ['id', 'nombre'] },
                    { model: Productos, as: 'productoDestino', attributes: ['id', 'nombre'] },
                    { model: User, as: 'usuario', attributes: ['id', 'username', 'nombre'] }
                ],
                order: [['fecha', 'DESC'], ['id', 'DESC']]
            });
            res.status(200).json(items.map(mapProduccion));
        } catch (error) {
            handleError(res, error, 'Error al listar producciones');
        }
    }

    public static async crear(_req: Request, res: Response): Promise<void> {
        res.status(410).json({ mensaje: 'Producción ya no admite operaciones nuevas. El historial se conserva.' });
    }
}
