import { Request, Response } from 'express';
import { Productos, Produccion, sequelize, User } from '../models';
import { handleError } from '../utils/error.handler';
import { DtoValidator } from '../utils/dto.validador';
import { getAuthUser } from '../utils/auth-user';
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
        usuario: item.usuario ? { id: item.usuario.id, username: item.usuario.username } : null
    };
}

export class ProduccionController {
    public static async listar(_req: Request, res: Response): Promise<void> {
        try {
            const items = await Produccion.findAll({
                include: [
                    { model: Productos, as: 'productoOrigen', attributes: ['id', 'nombre'] },
                    { model: Productos, as: 'productoDestino', attributes: ['id', 'nombre'] },
                    { model: User, as: 'usuario', attributes: ['id', 'username'] }
                ],
                order: [['fecha', 'DESC'], ['id', 'DESC']]
            });
            res.status(200).json(items.map(mapProduccion));
        } catch (error) {
            handleError(res, error, 'Error al listar producciones');
        }
    }

    public static async crear(req: Request, res: Response): Promise<void> {
        const usuario = getAuthUser(req);
        if (!usuario) {
            res.status(401).json({ mensaje: 'Usuario no autenticado' });
            return;
        }
        const datos = await DtoValidator.validateAndRespond(CrearProduccionDTO, req.body, res);
        if (!datos) {
            return;
        }
        if (datos.id_producto_origen === datos.id_producto_destino) {
            res.status(400).json({ mensaje: 'El producto de origen y destino deben ser distintos' });
            return;
        }
        const entrada = toQty(datos.cantidad_entrada);
        const salida = toQty(datos.cantidad_salida);
        const merma = Math.round((entrada - salida) * 1000) / 1000;

        const transaction = await sequelize.transaction();
        try {
            const salidaStock = await aplicarStock({
                transaction,
                idProducto: datos.id_producto_origen,
                delta: -entrada,
                tipo: TIPO_INVENTARIO.SALIDA,
                origen: 'PRODUCCION',
                origenId: null,
                idUsuario: usuario.id,
                observacion: 'Consumo de proceso'
            });
            if (!salidaStock.ok) {
                await transaction.rollback();
                res.status(409).json({ mensaje: salidaStock.mensaje });
                return;
            }
            const entradaStock = await aplicarStock({
                transaction,
                idProducto: datos.id_producto_destino,
                delta: salida,
                tipo: TIPO_INVENTARIO.ENTRADA,
                origen: 'PRODUCCION',
                origenId: null,
                idUsuario: usuario.id,
                observacion: 'Producto procesado'
            });
            if (!entradaStock.ok) {
                await transaction.rollback();
                res.status(409).json({ mensaje: entradaStock.mensaje });
                return;
            }

            const prod = await Produccion.create({
                fecha: new Date(),
                id_producto_origen: datos.id_producto_origen,
                cantidad_entrada: entrada,
                id_producto_destino: datos.id_producto_destino,
                cantidad_salida: salida,
                merma,
                observacion: datos.observacion || null,
                id_usuario: usuario.id
            }, { transaction });

            await transaction.commit();
            const creado = await Produccion.findByPk(prod.get('id') as number, {
                include: [
                    { model: Productos, as: 'productoOrigen', attributes: ['id', 'nombre'] },
                    { model: Productos, as: 'productoDestino', attributes: ['id', 'nombre'] },
                    { model: User, as: 'usuario', attributes: ['id', 'username'] }
                ]
            });
            res.status(201).json({ mensaje: 'Producción registrada', data: mapProduccion(creado) });
        } catch (error) {
            await transaction.rollback();
            handleError(res, error, 'Error al registrar la producción');
        }
    }
}
