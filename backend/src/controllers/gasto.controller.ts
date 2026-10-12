import { Request, Response } from 'express';
import { Gasto, PagoGasto, sequelize, User } from '../models';
import { aplicarFiltroFecha } from '../utils/fecha';
import { handleError } from '../utils/error.handler';
import { DtoValidator } from '../utils/dto.validador';
import { getAuthUser, mapUsuarioResumen } from '../utils/auth-user';
import { roundMoney, toMoney } from '../utils/money';
import { obtenerCajaAbierta, registrarEgresosPartidos } from '../utils/caja-ingreso';
import { ORIGEN_MOVIMIENTO } from '../constants/caja.constants';
import { CrearGastoDTO, PagarGastoDTO } from '../dtos/gasto.dto';
import { camposPagoDocumento } from '../utils/metodo-pago';
import { resolverPlazoCredito } from '../utils/credito';
import {
    CONDICION_GASTO,
    diasGastoParaVencer,
    esGastoVencido,
    ESTADO_GASTO,
    estadoGastoPorSaldo
} from '../constants/gasto.constants';

function mapPagoGasto(item: any) {
    return {
        id: item.id,
        id_gasto: item.id_gasto,
        monto: toMoney(item.monto),
        metodo_pago: item.metodo_pago,
        monto_efectivo: toMoney(item.monto_efectivo),
        monto_qr: toMoney(item.monto_qr),
        referencia: item.referencia,
        observacion: item.observacion,
        fecha: item.fecha,
        usuario: mapUsuarioResumen(item.usuario)
    };
}

function mapGasto(item: any) {
    const descontar = Boolean(item.descontar_caja) && item.id_caja != null;
    const monto = toMoney(item.monto);
    const condicion = item.condicion || CONDICION_GASTO.CONTADO;
    const saldo = condicion === CONDICION_GASTO.CREDITO ? toMoney(item.saldo_pendiente) : 0;
    const estado = condicion === CONDICION_GASTO.CREDITO ? item.estado || ESTADO_GASTO.PENDIENTE : ESTADO_GASTO.PAGADO;
    return {
        id: item.id,
        tipo: item.tipo,
        concepto: item.concepto,
        categoria: item.categoria || 'Otros',
        persona: item.persona || null,
        monto,
        condicion,
        saldo_pendiente: saldo,
        pagado: roundMoney(monto - saldo),
        estado,
        plazo_dias: item.plazo_dias != null ? Number(item.plazo_dias) : null,
        fecha_vencimiento: item.fecha_vencimiento || null,
        vencido: esGastoVencido(item.fecha_vencimiento, saldo, estado),
        dias_vencimiento: diasGastoParaVencer(item.fecha_vencimiento),
        metodo_pago: item.metodo_pago,
        monto_efectivo: toMoney(item.monto_efectivo),
        monto_qr: toMoney(item.monto_qr),
        descontar_caja: descontar,
        referencia: item.referencia,
        observacion: item.observacion,
        id_caja: item.id_caja,
        fecha: item.fecha,
        usuario: mapUsuarioResumen(item.usuario),
        pagos: (item.pagos || []).map(mapPagoGasto)
    };
}

export class GastoController {
    public static async listar(req: Request, res: Response): Promise<void> {
        try {
            const where: any = {};
            if (typeof req.query.tipo === 'string' && req.query.tipo) {
                where.tipo = req.query.tipo;
            }
            if (typeof req.query.condicion === 'string' && req.query.condicion) {
                where.condicion = req.query.condicion;
            }
            if (typeof req.query.metodo === 'string' && req.query.metodo) {
                where.metodo_pago = req.query.metodo;
            }
            if (typeof req.query.categoria === 'string' && req.query.categoria) {
                where.categoria = req.query.categoria;
            }
            aplicarFiltroFecha(where, req.query);
            const gastos = await Gasto.findAll({
                where,
                include: [
                    { model: User, as: 'usuario', attributes: ['id', 'username', 'nombre'] },
                    { model: PagoGasto, as: 'pagos', include: [{ model: User, as: 'usuario', attributes: ['id', 'username', 'nombre'] }] }
                ],
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
            const aCredito = datos.condicion === CONDICION_GASTO.CREDITO;
            const descontarCaja = aCredito ? false : datos.tipo === 'GASTO_EMPRESA' ? true : datos.descontar_caja !== false;
            let idCaja: number | null = null;

            if (descontarCaja) {
                const caja = await obtenerCajaAbierta(transaction);
                if (!caja) {
                    await transaction.rollback();
                    res.status(409).json({ mensaje: 'Debe haber una caja abierta para descontar de caja' });
                    return;
                }
                idCaja = caja.get('id') as number;
            }

            const monto = toMoney(datos.monto);
            let metodoPago = datos.metodo_pago || 'EFECTIVO';
            let montoEfectivo: number | null = null;
            let montoQr: number | null = null;
            if (descontarCaja) {
                const pagoDoc = camposPagoDocumento(datos, monto);
                if (!pagoDoc.ok) {
                    await transaction.rollback();
                    res.status(400).json({ mensaje: pagoDoc.mensaje });
                    return;
                }
                metodoPago = pagoDoc.metodo_pago;
                montoEfectivo = pagoDoc.monto_efectivo;
                montoQr = pagoDoc.monto_qr;
            }
            const saldoPendiente = aCredito ? monto : 0;
            const plazo = resolverPlazoCredito(saldoPendiente, datos.plazo_dias, datos.fecha_vencimiento);
            if (!plazo.ok) {
                await transaction.rollback();
                res.status(400).json({ mensaje: plazo.mensaje });
                return;
            }

            const gasto = await Gasto.create({
                tipo: datos.tipo,
                concepto: datos.concepto.trim(),
                categoria: datos.categoria || (datos.tipo === 'GASTO_EMPRESA' ? 'Otros' : null),
                persona: datos.persona?.trim() || null,
                monto,
                condicion: aCredito ? CONDICION_GASTO.CREDITO : CONDICION_GASTO.CONTADO,
                saldo_pendiente: saldoPendiente,
                estado: aCredito ? ESTADO_GASTO.PENDIENTE : ESTADO_GASTO.PAGADO,
                plazo_dias: plazo.plazo_dias,
                fecha_vencimiento: plazo.fecha_vencimiento,
                metodo_pago: metodoPago,
                monto_efectivo: montoEfectivo,
                monto_qr: montoQr,
                descontar_caja: descontarCaja,
                referencia: datos.referencia || null,
                observacion: datos.observacion || null,
                id_caja: idCaja,
                fecha: new Date(),
                id_usuario: usuario.id
            }, { transaction });

            if (descontarCaja && idCaja != null) {
                const egreso = await registrarEgresosPartidos({
                    transaction,
                    idCaja,
                    idUsuario: usuario.id,
                    categoria: datos.tipo,
                    concepto: datos.concepto.trim(),
                    monto,
                    metodoPago,
                    montoEfectivo: datos.monto_efectivo,
                    montoQr: datos.monto_qr,
                    referencia: datos.referencia || null,
                    observacion: datos.observacion || null,
                    origen: ORIGEN_MOVIMIENTO.GASTO,
                    origenId: gasto.get('id') as number
                });
                if (!egreso.ok) {
                    await transaction.rollback();
                    res.status(400).json({ mensaje: egreso.mensaje });
                    return;
                }
            }

            await transaction.commit();
            const creado = await Gasto.findByPk(gasto.get('id') as number, {
                include: [{ model: User, as: 'usuario', attributes: ['id', 'username', 'nombre'] }]
            });
            res.status(201).json({ mensaje: 'Registrado correctamente', data: mapGasto(creado) });
        } catch (error) {
            await transaction.rollback();
            handleError(res, error, 'Error al registrar el gasto');
        }
    }

    /** Amortiza un gasto a crédito. Este pago sí es un egreso real de caja. */
    public static async pagar(req: Request, res: Response): Promise<void> {
        const usuario = getAuthUser(req);
        if (!usuario) {
            res.status(401).json({ mensaje: 'Usuario no autenticado' });
            return;
        }
        const datos = await DtoValidator.validateAndRespond(PagarGastoDTO, req.body, res);
        if (!datos) {
            return;
        }
        const monto = toMoney(datos.monto);
        const transaction = await sequelize.transaction();
        try {
            const gasto = await Gasto.findByPk(Number(req.params.id), {
                transaction,
                lock: transaction.LOCK.UPDATE
            });
            if (!gasto) {
                await transaction.rollback();
                res.status(404).json({ mensaje: `No se encontró el gasto con ID ${req.params.id}` });
                return;
            }
            if (gasto.get('condicion') !== CONDICION_GASTO.CREDITO) {
                await transaction.rollback();
                res.status(409).json({ mensaje: 'Este gasto fue registrado al contado y no admite pagos' });
                return;
            }
            const saldo = toMoney(gasto.get('saldo_pendiente'));
            if (saldo <= 0) {
                await transaction.rollback();
                res.status(409).json({ mensaje: 'Este gasto ya está pagado' });
                return;
            }
            if (monto > saldo) {
                await transaction.rollback();
                res.status(400).json({ mensaje: `El monto supera el saldo pendiente (${saldo})` });
                return;
            }

            const caja = await obtenerCajaAbierta(transaction);
            if (!caja) {
                await transaction.rollback();
                res.status(409).json({ mensaje: 'Debe haber una caja abierta para registrar un pago' });
                return;
            }
            const idCaja = caja.get('id') as number;

            const pagoDoc = camposPagoDocumento(datos, monto);
            if (!pagoDoc.ok) {
                await transaction.rollback();
                res.status(400).json({ mensaje: pagoDoc.mensaje });
                return;
            }

            const saldoNuevo = roundMoney(saldo - monto);
            await gasto.update({
                saldo_pendiente: saldoNuevo,
                estado: estadoGastoPorSaldo(toMoney(gasto.get('monto')), saldoNuevo)
            }, { transaction });

            const pago = await PagoGasto.create({
                id_gasto: gasto.get('id') as number,
                id_caja: idCaja,
                monto: pagoDoc.monto,
                metodo_pago: pagoDoc.metodo_pago,
                monto_efectivo: pagoDoc.monto_efectivo,
                monto_qr: pagoDoc.monto_qr,
                referencia: datos.referencia || null,
                observacion: datos.observacion || null,
                fecha: new Date(),
                id_usuario: usuario.id
            }, { transaction });

            const persona = (gasto.get('persona') as string) || '';
            const egreso = await registrarEgresosPartidos({
                transaction,
                idCaja,
                idUsuario: usuario.id,
                categoria: gasto.get('tipo') as string,
                concepto: `Pago ${gasto.get('concepto')}${persona ? ` - ${persona}` : ''}`,
                monto,
                metodoPago: datos.metodo_pago,
                montoEfectivo: datos.monto_efectivo,
                montoQr: datos.monto_qr,
                referencia: datos.referencia || null,
                observacion: datos.observacion || null,
                origen: ORIGEN_MOVIMIENTO.GASTO,
                origenId: gasto.get('id') as number
            });
            if (!egreso.ok) {
                await transaction.rollback();
                res.status(400).json({ mensaje: egreso.mensaje });
                return;
            }

            await transaction.commit();
            const actualizado = await Gasto.findByPk(gasto.get('id') as number, {
                include: [
                    { model: User, as: 'usuario', attributes: ['id', 'username', 'nombre'] },
                    { model: PagoGasto, as: 'pagos', include: [{ model: User, as: 'usuario', attributes: ['id', 'username', 'nombre'] }] }
                ]
            });
            res.status(201).json({ mensaje: 'Pago registrado', data: mapGasto(actualizado), pago: mapPagoGasto(pago) });
        } catch (error) {
            await transaction.rollback();
            handleError(res, error, 'Error al registrar el pago del gasto');
        }
    }
}
