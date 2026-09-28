import { Request, Response } from 'express';
import { Op, WhereOptions } from 'sequelize';
import { Caja, Compra, MovimientoCaja, sequelize, User, Venta } from '../models';
import { handleError } from '../utils/error.handler';
import { DtoValidator } from '../utils/dto.validador';
import { getAuthUser } from '../utils/auth-user';
import { clasificarDiferencia, roundMoney, toMoney } from '../utils/money';
import {
    ESTADO_CAJA,
    ORIGEN_MOVIMIENTO,
    TIPO_MOVIMIENTO
} from '../constants/caja.constants';
import { ESTADO_VENTA } from '../constants/venta.constants';
import { ESTADO_COMPRA } from '../constants/compra.constants';
import { resumirMovimientos } from '../utils/caja-resumen';
import { registrarEgresosPartidos, registrarIngresosPartidos } from '../utils/caja-ingreso';
import {
    AbrirCajaDTO,
    CerrarCajaDTO,
    CrearMovimientoCajaDTO,
    categoriaCorrespondeAlTipo
} from '../dtos/caja.dto';

const usuarioAtributos = ['id', 'username'];

export class CajaController {
    public static async obtenerAbierta(req: Request, res: Response): Promise<void> {
        try {
            const caja = await Caja.findOne({
                where: { estado: ESTADO_CAJA.ABIERTA },
                include: CajaController.includesUsuarios(),
                order: [['id', 'DESC']]
            });

            if (!caja) {
                res.status(200).json(null);
                return;
            }

            res.status(200).json(await CajaController.toDetalle(caja));
        } catch (error) {
            handleError(res, error, 'Error al obtener la caja abierta');
        }
    }

    public static async abrir(req: Request, res: Response): Promise<void> {
        const usuario = getAuthUser(req);
        if (!usuario) {
            res.status(401).json({ mensaje: 'Usuario no autenticado' });
            return;
        }

        const datos = await DtoValidator.validateAndRespond(AbrirCajaDTO, req.body, res);
        if (!datos) {
            return;
        }

        const transaction = await sequelize.transaction();
        try {
            const abierta = await Caja.findOne({
                where: { estado: ESTADO_CAJA.ABIERTA },
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (abierta) {
                await transaction.rollback();
                res.status(409).json({
                    mensaje: 'Ya existe una caja abierta. Ciérrala antes de abrir otra.'
                });
                return;
            }

            const saldoInicial = toMoney(datos.saldo_inicial);
            const nueva = await Caja.create({
                fecha_apertura: new Date(),
                saldo_inicial: saldoInicial,
                saldo_esperado: saldoInicial,
                estado: ESTADO_CAJA.ABIERTA,
                id_usuario_apertura: usuario.id,
                observacion: datos.observacion || null
            }, { transaction });

            await transaction.commit();

            const caja = await Caja.findByPk(nueva.get('id') as number, {
                include: CajaController.includesUsuarios()
            });

            res.status(201).json({
                mensaje: 'Caja abierta correctamente',
                data: await CajaController.toDetalle(caja!)
            });
        } catch (error) {
            await transaction.rollback();
            handleError(res, error, 'Error al abrir la caja');
        }
    }

    public static async historial(req: Request, res: Response): Promise<void> {
        try {
            const where: WhereOptions = {};
            const { fecha_desde, fecha_hasta, estado } = req.query;

            if (estado && typeof estado === 'string') {
                if (estado !== ESTADO_CAJA.ABIERTA && estado !== ESTADO_CAJA.CERRADA) {
                    res.status(400).json({ mensaje: 'El estado debe ser ABIERTA o CERRADA' });
                    return;
                }
                where.estado = estado;
            }

            if (fecha_desde || fecha_hasta) {
                const rango: { [Op.gte]?: Date; [Op.lte]?: Date } = {};
                if (typeof fecha_desde === 'string' && fecha_desde) {
                    rango[Op.gte] = new Date(`${fecha_desde}T00:00:00`);
                }
                if (typeof fecha_hasta === 'string' && fecha_hasta) {
                    rango[Op.lte] = new Date(`${fecha_hasta}T23:59:59`);
                }
                where.fecha_apertura = rango;
            }

            const cajas = await Caja.findAll({
                where,
                include: CajaController.includesUsuarios(),
                order: [['fecha_apertura', 'DESC']]
            });

            const data = [];
            for (const caja of cajas) {
                data.push(await CajaController.toResumen(caja));
            }

            res.status(200).json(data);
        } catch (error) {
            handleError(res, error, 'Error al listar el historial de cajas');
        }
    }

    public static async obtenerPorId(req: Request, res: Response): Promise<void> {
        try {
            const caja = await CajaController.buscarPorId(req.params.id);
            if (!caja) {
                res.status(404).json({ mensaje: `No se encontró la caja con ID ${req.params.id}` });
                return;
            }
            res.status(200).json(await CajaController.toDetalle(caja));
        } catch (error) {
            handleError(res, error, 'Error al obtener el detalle de la caja');
        }
    }

    public static async cerrar(req: Request, res: Response): Promise<void> {
        const usuario = getAuthUser(req);
        if (!usuario) {
            res.status(401).json({ mensaje: 'Usuario no autenticado' });
            return;
        }

        const datos = await DtoValidator.validateAndRespond(CerrarCajaDTO, req.body, res);
        if (!datos) {
            return;
        }

        const transaction = await sequelize.transaction();
        try {
            const caja = await Caja.findOne({
                where: { id: req.params.id },
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (!caja) {
                await transaction.rollback();
                res.status(404).json({ mensaje: `No se encontró la caja con ID ${req.params.id}` });
                return;
            }

            if (caja.get('estado') !== ESTADO_CAJA.ABIERTA) {
                await transaction.rollback();
                res.status(409).json({ mensaje: 'La caja ya está cerrada' });
                return;
            }

            const totales = await CajaController.calcularTotales(caja.get('id') as number, transaction);
            const saldoContado = toMoney(datos.saldo_contado);
            const diferencia = roundMoney(saldoContado - totales.efectivoEsperado);

            await caja.update({
                fecha_cierre: new Date(),
                saldo_esperado: totales.saldoEsperado,
                saldo_contado: saldoContado,
                diferencia,
                estado: ESTADO_CAJA.CERRADA,
                id_usuario_cierre: usuario.id,
                observacion: datos.observacion ?? caja.get('observacion')
            }, { transaction });

            await transaction.commit();

            const actualizada = await CajaController.buscarPorId(req.params.id);
            res.status(200).json({
                mensaje: 'Caja cerrada correctamente',
                data: await CajaController.toDetalle(actualizada!)
            });
        } catch (error) {
            await transaction.rollback();
            handleError(res, error, 'Error al cerrar la caja');
        }
    }

    public static async listarMovimientos(req: Request, res: Response): Promise<void> {
        try {
            const caja = await Caja.findByPk(req.params.id);
            if (!caja) {
                res.status(404).json({ mensaje: `No se encontró la caja con ID ${req.params.id}` });
                return;
            }

            const movimientos = await MovimientoCaja.findAll({
                where: { id_caja: req.params.id },
                include: [{ model: User, as: 'usuario', attributes: usuarioAtributos }],
                order: [['fecha', 'DESC'], ['id', 'DESC']]
            });

            res.status(200).json(movimientos.map((item) => CajaController.mapMovimiento(item)));
        } catch (error) {
            handleError(res, error, 'Error al listar los movimientos de caja');
        }
    }

    public static async crearMovimiento(req: Request, res: Response): Promise<void> {
        const usuario = getAuthUser(req);
        if (!usuario) {
            res.status(401).json({ mensaje: 'Usuario no autenticado' });
            return;
        }

        const datos = await DtoValidator.validateAndRespond(CrearMovimientoCajaDTO, req.body, res);
        if (!datos) {
            return;
        }

        if (!categoriaCorrespondeAlTipo(datos.tipo, datos.categoria)) {
            res.status(400).json({
                mensaje: 'La categoría no corresponde al tipo de movimiento seleccionado'
            });
            return;
        }

        const transaction = await sequelize.transaction();
        try {
            const caja = await Caja.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
            if (!caja) {
                await transaction.rollback();
                res.status(404).json({ mensaje: `No se encontró la caja con ID ${req.params.id}` });
                return;
            }

            if (caja.get('estado') !== ESTADO_CAJA.ABIERTA) {
                await transaction.rollback();
                res.status(409).json({ mensaje: 'No se pueden registrar movimientos en una caja cerrada' });
                return;
            }

            const fn = datos.tipo === TIPO_MOVIMIENTO.INGRESO ? registrarIngresosPartidos : registrarEgresosPartidos;
            const resultado = await fn({
                transaction,
                idCaja: caja.get('id') as number,
                idUsuario: usuario.id,
                categoria: datos.categoria,
                concepto: datos.concepto.trim(),
                monto: toMoney(datos.monto),
                metodoPago: datos.metodo_pago,
                montoEfectivo: datos.monto_efectivo,
                montoQr: datos.monto_qr,
                referencia: datos.referencia || null,
                observacion: datos.observacion || null,
                origen: ORIGEN_MOVIMIENTO.MANUAL,
                origenId: null
            });
            if (!resultado.ok) {
                await transaction.rollback();
                res.status(400).json({ mensaje: resultado.mensaje });
                return;
            }

            await transaction.commit();
            const detalle = await CajaController.toDetalle(caja);
            res.status(201).json({
                mensaje: 'Movimiento registrado correctamente',
                data: detalle.movimientos?.[0] || null
            });
        } catch (error) {
            await transaction.rollback();
            handleError(res, error, 'Error al registrar el movimiento');
        }
    }

    private static includesUsuarios() {
        return [
            { model: User, as: 'usuarioApertura', attributes: usuarioAtributos },
            { model: User, as: 'usuarioCierre', attributes: usuarioAtributos }
        ];
    }

    private static async buscarPorId(id: string) {
        return Caja.findByPk(id, {
            include: CajaController.includesUsuarios()
        });
    }

    private static async calcularTotales(idCaja: number, transaction?: any) {
        const movimientos = await MovimientoCaja.findAll({
            where: { id_caja: idCaja },
            transaction
        });

        const flujo = resumirMovimientos(movimientos);
        const caja = await Caja.findByPk(idCaja, { transaction });
        const saldoInicial = toMoney(caja?.get('saldo_inicial'));
        const saldoEsperado = roundMoney(saldoInicial + flujo.ingresos - flujo.egresos);
        const efectivoEsperado = roundMoney(saldoInicial + flujo.efectivo_ingresos - flujo.efectivo_egresos);
        const qrEsperado = roundMoney(flujo.qr_ingresos - flujo.qr_egresos);

        return {
            saldoInicial,
            ingresos: flujo.ingresos,
            egresos: flujo.egresos,
            saldoEsperado,
            efectivoEsperado,
            qrEsperado,
            movimientos,
            desglose: {
                cobrado_clientes: flujo.cobros_clientes,
                cobrado_neto: flujo.cobrado_neto,
                otros_ingresos: flujo.otros_ingresos,
                pagos_proveedor: flujo.pagos_proveedor,
                gastos_empresa: flujo.gastos_empresa,
                retiros: flujo.retiros,
                anulaciones_venta: flujo.anulaciones_venta,
                otros_egresos: flujo.otros_egresos,
                efectivo_ingresos: flujo.efectivo_ingresos,
                efectivo_egresos: flujo.efectivo_egresos,
                qr_ingresos: flujo.qr_ingresos,
                qr_egresos: flujo.qr_egresos
            }
        };
    }

    private static async toResumen(caja: any) {
        const totales = await CajaController.calcularTotales(caja.id);
        const saldoContado = caja.saldo_contado != null ? toMoney(caja.saldo_contado) : null;
        const diferencia = caja.diferencia != null
            ? toMoney(caja.diferencia)
            : (saldoContado != null ? roundMoney(saldoContado - totales.efectivoEsperado) : null);

        return {
            id: caja.id,
            fecha_apertura: caja.fecha_apertura,
            fecha_cierre: caja.fecha_cierre,
            estado: caja.estado,
            observacion: caja.observacion,
            saldo_inicial: totales.saldoInicial,
            ingresos: totales.ingresos,
            egresos: totales.egresos,
            saldo_esperado: totales.saldoEsperado,
            efectivo_esperado: totales.efectivoEsperado,
            qr_esperado: totales.qrEsperado,
            desglose: totales.desglose,
            saldo_contado: saldoContado,
            diferencia,
            resultado_arqueo: diferencia == null ? null : clasificarDiferencia(diferencia),
            usuario_apertura: caja.usuarioApertura
                ? { id: caja.usuarioApertura.id, username: caja.usuarioApertura.username }
                : null,
            usuario_cierre: caja.usuarioCierre
                ? { id: caja.usuarioCierre.id, username: caja.usuarioCierre.username }
                : null
        };
    }

    private static async toDetalle(caja: any) {
        const resumen = await CajaController.toResumen(caja);
        const [movimientos, porCobrar, porPagar] = await Promise.all([
            MovimientoCaja.findAll({
                where: { id_caja: caja.id },
                include: [{ model: User, as: 'usuario', attributes: usuarioAtributos }],
                order: [['fecha', 'DESC'], ['id', 'DESC']]
            }),
            Venta.sum('saldo_pendiente', {
                where: { estado: { [Op.in]: [ESTADO_VENTA.PENDIENTE, ESTADO_VENTA.PARCIAL] } }
            }),
            Compra.sum('saldo_pendiente', {
                where: { estado: { [Op.in]: [ESTADO_COMPRA.PENDIENTE, ESTADO_COMPRA.PARCIAL] } }
            })
        ]);

        return {
            ...resumen,
            por_cobrar: roundMoney(Number(porCobrar || 0)),
            por_pagar: roundMoney(Number(porPagar || 0)),
            movimientos: movimientos.map((item) => CajaController.mapMovimiento(item))
        };
    }

    private static mapMovimiento(movimiento: any) {
        const tipo = movimiento.tipo;
        const monto = toMoney(movimiento.monto);
        return {
            id: movimiento.id,
            id_caja: movimiento.id_caja,
            tipo,
            categoria: movimiento.categoria,
            concepto: movimiento.concepto,
            monto,
            ingreso: tipo === TIPO_MOVIMIENTO.INGRESO ? monto : 0,
            egreso: tipo === TIPO_MOVIMIENTO.EGRESO ? monto : 0,
            metodo_pago: movimiento.metodo_pago,
            referencia: movimiento.referencia,
            observacion: movimiento.observacion,
            origen: movimiento.origen,
            origen_id: movimiento.origen_id,
            fecha: movimiento.fecha,
            usuario: movimiento.usuario
                ? { id: movimiento.usuario.id, username: movimiento.usuario.username }
                : null
        };
    }
}
