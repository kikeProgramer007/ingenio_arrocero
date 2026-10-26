import { Request, Response } from 'express';
import { ArqueoCaja, MovimientoCaja, User, sequelize } from '../models';
import {
    CATEGORIA_EGRESO,
    CATEGORIA_INGRESO,
    METODO_PAGO,
    ORIGEN_MOVIMIENTO
} from '../constants/caja.constants';
import { getAuthUser, mapUsuarioResumen } from '../utils/auth-user';
import {
    obtenerCajaAbierta,
    obtenerCajaChica,
    registrarEgresoCaja,
    registrarIngresoCaja,
    saldoEfectivoCaja
} from '../utils/caja-ingreso';
import { resumirMovimientos } from '../utils/caja-resumen';
import { aplicarFiltroFecha } from '../utils/fecha';
import { handleError } from '../utils/error.handler';
import { clasificarDiferencia, roundMoney, toMoney } from '../utils/money';

function mapMovimiento(item: any) {
    return {
        id: item.id,
        fecha: item.fecha,
        tipo: item.tipo,
        categoria: item.categoria,
        concepto: item.concepto,
        monto: toMoney(item.monto),
        metodo_pago: item.metodo_pago,
        referencia: item.referencia,
        observacion: item.observacion,
        origen: item.origen,
        usuario: mapUsuarioResumen(item.usuario)
    };
}

export class CajaChicaController {
    public static async resumen(_req: Request, res: Response): Promise<void> {
        try {
            const caja = await obtenerCajaChica();
            if (!caja) {
                res.status(404).json({ mensaje: 'La caja chica todavía no está disponible' });
                return;
            }
            const id = caja.get('id') as number;
            const movimientos = await MovimientoCaja.findAll({ where: { id_caja: id } });
            const flujo = resumirMovimientos(movimientos);
            const saldo = await saldoEfectivoCaja(id);
            const arqueos = await ArqueoCaja.findAll({
                where: { id_caja: id },
                include: [{ model: User, as: 'usuario', attributes: ['id', 'username', 'nombre'] }],
                order: [['fecha', 'DESC']],
                limit: 8
            });
            res.status(200).json({
                id,
                tipo: 'CHICA',
                saldo,
                ingresos: flujo.ingresos,
                egresos: flujo.egresos,
                arqueos: arqueos.map((item: any) => ({
                    id: item.id,
                    fecha: item.fecha,
                    saldo_esperado: toMoney(item.saldo_esperado),
                    saldo_contado: toMoney(item.saldo_contado),
                    diferencia: toMoney(item.diferencia),
                    resultado: clasificarDiferencia(toMoney(item.diferencia)),
                    observacion: item.observacion,
                    usuario: mapUsuarioResumen(item.usuario)
                }))
            });
        } catch (error) {
            handleError(res, error, 'Error al consultar la caja chica');
        }
    }

    public static async movimientos(req: Request, res: Response): Promise<void> {
        try {
            const caja = await obtenerCajaChica();
            if (!caja) {
                res.status(404).json({ mensaje: 'La caja chica todavía no está disponible' });
                return;
            }
            const where: Record<string, unknown> = { id_caja: caja.get('id') };
            if (typeof req.query.tipo === 'string' && req.query.tipo) {
                where.tipo = req.query.tipo;
            }
            aplicarFiltroFecha(where, req.query);
            const filas = await MovimientoCaja.findAll({
                where,
                include: [{ model: User, as: 'usuario', attributes: ['id', 'username', 'nombre'] }],
                order: [['fecha', 'DESC'], ['id', 'DESC']]
            });
            res.status(200).json(filas.map(mapMovimiento));
        } catch (error) {
            handleError(res, error, 'Error al listar movimientos de caja chica');
        }
    }

    public static async aportar(req: Request, res: Response): Promise<void> {
        const usuario = getAuthUser(req);
        if (!usuario) {
            res.status(401).json({ mensaje: 'Usuario no autenticado' });
            return;
        }
        const origen = String(req.body?.origen || '');
        const monto = toMoney(req.body?.monto);
        const motivo = String(req.body?.motivo || '').trim();
        const procedencia = String(req.body?.procedencia || '').trim();
        if (monto <= 0) {
            res.status(400).json({ mensaje: 'El monto debe ser mayor a 0' });
            return;
        }
        if (!motivo) {
            res.status(400).json({ mensaje: 'El motivo es obligatorio' });
            return;
        }
        if (origen !== 'CAJA_PRINCIPAL' && origen !== 'EXTERNO') {
            res.status(400).json({ mensaje: 'La procedencia debe ser caja principal o una fuente externa' });
            return;
        }
        if (origen === 'EXTERNO' && !procedencia) {
            res.status(400).json({ mensaje: 'Indique la procedencia del aporte externo' });
            return;
        }

        const transaction = await sequelize.transaction();
        try {
            const chica = await obtenerCajaChica(transaction);
            if (!chica) {
                await transaction.rollback();
                res.status(404).json({ mensaje: 'La caja chica todavía no está disponible' });
                return;
            }
            const idChica = chica.get('id') as number;

            if (origen === 'CAJA_PRINCIPAL') {
                const principal = await obtenerCajaAbierta(transaction);
                if (!principal) {
                    await transaction.rollback();
                    res.status(409).json({ mensaje: 'Debe haber una caja principal abierta para transferir fondos' });
                    return;
                }
                const idPrincipal = principal.get('id') as number;
                const disponible = await saldoEfectivoCaja(idPrincipal, transaction);
                if (monto > disponible) {
                    await transaction.rollback();
                    res.status(409).json({
                        mensaje: `La caja principal no tiene efectivo suficiente. Disponible: ${disponible}`
                    });
                    return;
                }
                const concepto = `Transferencia a caja chica. ${motivo}`;
                await registrarEgresoCaja({
                    transaction,
                    idCaja: idPrincipal,
                    idUsuario: usuario.id,
                    categoria: CATEGORIA_EGRESO.TRANSFERENCIA_CAJA,
                    concepto,
                    monto,
                    metodoPago: METODO_PAGO.EFECTIVO,
                    observacion: motivo,
                    origen: ORIGEN_MOVIMIENTO.TRANSFERENCIA,
                    origenId: idChica
                });
                await registrarIngresoCaja({
                    transaction,
                    idCaja: idChica,
                    idUsuario: usuario.id,
                    categoria: CATEGORIA_INGRESO.TRANSFERENCIA_CAJA,
                    concepto: `Aporte desde caja principal. ${motivo}`,
                    monto,
                    metodoPago: METODO_PAGO.EFECTIVO,
                    observacion: motivo,
                    origen: ORIGEN_MOVIMIENTO.TRANSFERENCIA,
                    origenId: idPrincipal
                });
            } else {
                await registrarIngresoCaja({
                    transaction,
                    idCaja: idChica,
                    idUsuario: usuario.id,
                    categoria: CATEGORIA_INGRESO.APORTE_EXTERNO,
                    concepto: `Aporte externo (${procedencia}). ${motivo}`,
                    monto,
                    metodoPago: METODO_PAGO.EFECTIVO,
                    referencia: procedencia,
                    observacion: motivo,
                    origen: ORIGEN_MOVIMIENTO.APORTE
                });
            }

            await transaction.commit();
            const saldo = await saldoEfectivoCaja(idChica);
            res.status(201).json({
                mensaje: origen === 'CAJA_PRINCIPAL'
                    ? 'Fondos transferidos desde la caja principal. No es un gasto del negocio.'
                    : 'Aporte externo registrado. No es una venta.',
                saldo
            });
        } catch (error) {
            await transaction.rollback();
            handleError(res, error, 'Error al agregar fondos a la caja chica');
        }
    }

    public static async arquear(req: Request, res: Response): Promise<void> {
        const usuario = getAuthUser(req);
        if (!usuario) {
            res.status(401).json({ mensaje: 'Usuario no autenticado' });
            return;
        }
        const contado = toMoney(req.body?.saldo_contado);
        if (req.body?.saldo_contado == null || Number.isNaN(Number(req.body.saldo_contado)) || contado < 0) {
            res.status(400).json({ mensaje: 'Indique el efectivo contado' });
            return;
        }
        const transaction = await sequelize.transaction();
        try {
            const chica = await obtenerCajaChica(transaction);
            if (!chica) {
                await transaction.rollback();
                res.status(404).json({ mensaje: 'La caja chica todavía no está disponible' });
                return;
            }
            const id = chica.get('id') as number;
            const esperado = await saldoEfectivoCaja(id, transaction);
            const diferencia = roundMoney(contado - esperado);
            const arqueo = await ArqueoCaja.create({
                id_caja: id,
                saldo_esperado: esperado,
                saldo_contado: contado,
                diferencia,
                observacion: String(req.body?.observacion || '').trim() || null,
                fecha: new Date(),
                id_usuario: usuario.id
            }, { transaction });
            await transaction.commit();
            res.status(201).json({
                mensaje: 'Arqueo registrado. La caja chica sigue en uso.',
                data: {
                    id: arqueo.get('id'),
                    saldo_esperado: esperado,
                    saldo_contado: contado,
                    diferencia,
                    resultado: clasificarDiferencia(diferencia)
                }
            });
        } catch (error) {
            await transaction.rollback();
            handleError(res, error, 'Error al registrar el arqueo');
        }
    }
}
