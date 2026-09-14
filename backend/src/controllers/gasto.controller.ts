import { Request, Response } from 'express';
import { Gasto, sequelize, User } from '../models';
import { handleError } from '../utils/error.handler';
import { DtoValidator } from '../utils/dto.validador';
import { getAuthUser } from '../utils/auth-user';
import { toMoney } from '../utils/money';
import { obtenerCajaAbierta, registrarEgresoCaja } from '../utils/caja-ingreso';
import { ORIGEN_MOVIMIENTO } from '../constants/caja.constants';
import { CrearGastoDTO } from '../dtos/gasto.dto';

function mapGasto(item: any) {
    return {
        id: item.id,
        tipo: item.tipo,
        concepto: item.concepto,
        categoria: item.categoria || 'Otros',
        monto: toMoney(item.monto),
        metodo_pago: item.metodo_pago,
        referencia: item.referencia,
        observacion: item.observacion,
        id_caja: item.id_caja,
        fecha: item.fecha,
        usuario: item.usuario ? { id: item.usuario.id, username: item.usuario.username } : null
    };
}

export class GastoController {
    public static async listar(req: Request, res: Response): Promise<void> {
        try {
            const where: any = {};
            if (typeof req.query.tipo === 'string' && req.query.tipo) {
                where.tipo = req.query.tipo;
            }
            const gastos = await Gasto.findAll({
                where,
                include: [{ model: User, as: 'usuario', attributes: ['id', 'username'] }],
                order: [['fecha', 'DESC'], ['id', 'DESC']]
            });
            res.status(200).json(gastos.map(mapGasto));
        } catch (error) {
            handleError(res, error, 'Error al listar gastos');
        }
    }

    public static async crear(req: Request, res: Response): Promise<void> {
        const usuario = getAuthUser(req);
        if (!usuario) {
            res.status(401).json({ mensaje: 'Usuario no autenticado' });
            return;
        }
        const datos = await DtoValidator.validateAndRespond(CrearGastoDTO, req.body, res);
        if (!datos) {
            return;
        }
        const transaction = await sequelize.transaction();
        try {
            const caja = await obtenerCajaAbierta(transaction);
            if (!caja) {
                await transaction.rollback();
                res.status(409).json({ mensaje: 'Debe haber una caja abierta para registrar este movimiento' });
                return;
            }
            const idCaja = caja.get('id') as number;
            const monto = toMoney(datos.monto);
            const gasto = await Gasto.create({
                tipo: datos.tipo,
                concepto: datos.concepto.trim(),
                categoria: datos.categoria || (datos.tipo === 'GASTO_EMPRESA' ? 'Otros' : null),
                monto,
                metodo_pago: datos.metodo_pago,
                referencia: datos.referencia || null,
                observacion: datos.observacion || null,
                id_caja: idCaja,
                fecha: new Date(),
                id_usuario: usuario.id
            }, { transaction });

            await registrarEgresoCaja({
                transaction,
                idCaja,
                idUsuario: usuario.id,
                categoria: datos.tipo,
                concepto: datos.concepto.trim(),
                monto,
                metodoPago: datos.metodo_pago,
                referencia: datos.referencia || null,
                observacion: datos.observacion || null,
                origen: ORIGEN_MOVIMIENTO.GASTO,
                origenId: gasto.get('id') as number
            });

            await transaction.commit();
            const creado = await Gasto.findByPk(gasto.get('id') as number, {
                include: [{ model: User, as: 'usuario', attributes: ['id', 'username'] }]
            });
            res.status(201).json({ mensaje: 'Registrado correctamente', data: mapGasto(creado) });
        } catch (error) {
            await transaction.rollback();
            handleError(res, error, 'Error al registrar el gasto');
        }
    }
}
