import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Acopio, Campana, Productos, Proveedor, sequelize, User } from '../models';
import { ESTADO_CAMPANA } from '../models/campana.model';
import { handleError } from '../utils/error.handler';
import { DtoValidator } from '../utils/dto.validador';
import { getAuthUser, mapUsuarioResumen } from '../utils/auth-user';
import { roundMoney, toMoney } from '../utils/money';
import { obtenerCajaAbierta, registrarEgresosPartidos } from '../utils/caja-ingreso';
import { aplicarStock, TIPO_INVENTARIO, toQty } from '../utils/inventario';
import { CATEGORIA_EGRESO, ORIGEN_MOVIMIENTO } from '../constants/caja.constants';
import { CrearAcopioDTO, CrearCampanaDTO } from '../dtos/campana.dto';
import { camposPagoDocumento } from '../utils/metodo-pago';

function mapAcopio(item: any) {
    return {
        id: item.id,
        id_campana: item.id_campana,
        descripcion: item.descripcion,
        cantidad: toQty(item.cantidad),
        precio_unitario: toMoney(item.precio_unitario),
        total: toMoney(item.total),
        pago: toMoney(item.pago),
        metodo_pago: item.metodo_pago,
        monto_efectivo: toMoney(item.monto_efectivo),
        monto_qr: toMoney(item.monto_qr),
        fecha: item.fecha,
        observacion: item.observacion,
        proveedor: item.proveedor ? { id: item.proveedor.id, nombre: item.proveedor.nombre } : null,
        producto: item.producto ? { id: item.producto.id, nombre: item.producto.nombre } : null,
        usuario: mapUsuarioResumen(item.usuario)
    };
}

function mapCampana(item: any) {
    const acopios = (item.acopios || []).map(mapAcopio);
    const totalCantidad = acopios.reduce((acc: number, a: any) => acc + a.cantidad, 0);
    const totalMonto = acopios.reduce((acc: number, a: any) => acc + a.total, 0);
    return {
        id: item.id,
        nombre: item.nombre,
        fecha_inicio: item.fecha_inicio,
        fecha_fin: item.fecha_fin,
        meta_cantidad: item.meta_cantidad != null ? toQty(item.meta_cantidad) : null,
        estado: item.estado,
        observacion: item.observacion,
        total_cantidad: Math.round(totalCantidad * 1000) / 1000,
        total_monto: roundMoney(totalMonto),
        usuario: mapUsuarioResumen(item.usuario),
        acopios
    };
}

export class CampanaController {
    public static async listar(req: Request, res: Response): Promise<void> {
        try {
            const where: any = {};
            if (typeof req.query.estado === 'string' && req.query.estado) {
                where.estado = req.query.estado;
            }
            const desde = typeof req.query.fecha_desde === 'string' ? req.query.fecha_desde.slice(0, 10) : '';
            const hasta = typeof req.query.fecha_hasta === 'string' ? req.query.fecha_hasta.slice(0, 10) : '';
            if (desde) {
                where.fecha_inicio = { ...(where.fecha_inicio || {}), [Op.gte]: desde };
            }
            if (hasta) {
                where.fecha_inicio = { ...(where.fecha_inicio || {}), [Op.lte]: hasta };
            }
            const campanas = await Campana.findAll({
                where,
                include: [
                    { model: User, as: 'usuario', attributes: ['id', 'username', 'nombre'] },
                    {
                        model: Acopio,
                        as: 'acopios',
                        include: [
                            { model: Proveedor, as: 'proveedor', attributes: ['id', 'nombre'] },
                            { model: Productos, as: 'producto', attributes: ['id', 'nombre'] }
                        ]
                    }
                ],
                order: [['fecha_inicio', 'DESC'], ['id', 'DESC']]
            });
            res.status(200).json(campanas.map(mapCampana));
        } catch (error) {
            handleError(res, error, 'Error al listar campañas');
        }
    }

    public static async crear(_req: Request, res: Response): Promise<void> {
        res.status(410).json({ mensaje: 'Campaña de acopio ya no admite operaciones nuevas. El historial se conserva.' });
    }

    public static async cerrar(req: Request, res: Response): Promise<void> {
        try {
            const campana = await Campana.findByPk(req.params.id);
            if (!campana) {
                res.status(404).json({ mensaje: 'Campaña no encontrada' });
                return;
            }
            await campana.update({ estado: ESTADO_CAMPANA.CERRADA, fecha_fin: campana.get('fecha_fin') || new Date() });
            res.status(200).json({ mensaje: 'Campaña cerrada', data: mapCampana(campana) });
        } catch (error) {
            handleError(res, error, 'Error al cerrar la campaña');
        }
    }

    public static async crearAcopio(_req: Request, res: Response): Promise<void> {
        res.status(410).json({ mensaje: 'Campaña de acopio ya no admite operaciones nuevas. El historial se conserva.' });
    }
}
