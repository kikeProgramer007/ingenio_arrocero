import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Caja, Cliente, Compra, MovimientoCaja, User, Venta } from '../models';
import { handleError } from '../utils/error.handler';
import { clasificarDiferencia, roundMoney, toMoney } from '../utils/money';
import { inicioFinDia, inicioFinMes, rangoDesdeQuery } from '../utils/fecha';
import { CATEGORIA_EGRESO, CATEGORIA_INGRESO, ESTADO_CAJA, TIPO_MOVIMIENTO } from '../constants/caja.constants';
import { ESTADO_VENTA } from '../constants/venta.constants';
import { ESTADO_COMPRA } from '../constants/compra.constants';

const CATEGORIAS_COBRO = [CATEGORIA_INGRESO.VENTA, CATEGORIA_INGRESO.COBRANZA];

function sumarPorTipo(movimientos: any[]) {
    let ingresos = 0;
    let egresos = 0;
    for (const movimiento of movimientos) {
        const monto = toMoney(movimiento.get ? movimiento.get('monto') : movimiento.monto);
        const tipo = movimiento.get ? movimiento.get('tipo') : movimiento.tipo;
        if (tipo === TIPO_MOVIMIENTO.INGRESO) {
            ingresos += monto;
        } else {
            egresos += monto;
        }
    }
    return { ingresos: roundMoney(ingresos), egresos: roundMoney(egresos) };
}

function mapMovimiento(movimiento: any) {
    const tipo = movimiento.tipo;
    const monto = toMoney(movimiento.monto);
    const concepto: string = movimiento.concepto || '';
    const sep = concepto.lastIndexOf(' - ');
    return {
        id: movimiento.id,
        fecha: movimiento.fecha,
        tipo,
        origen: movimiento.origen,
        categoria: movimiento.categoria,
        concepto,
        contraparte: sep >= 0 ? concepto.slice(sep + 3) : '-',
        metodo_pago: movimiento.metodo_pago,
        ingreso: tipo === TIPO_MOVIMIENTO.INGRESO ? monto : 0,
        egreso: tipo === TIPO_MOVIMIENTO.EGRESO ? monto : 0,
        monto,
        usuario: movimiento.usuario
            ? { id: movimiento.usuario.id, username: movimiento.usuario.username }
            : null
    };
}

export class DashboardController {
    public static async resumen(req: Request, res: Response): Promise<void> {
        try {
            const { inicio: inicioDia, fin: finDia } = inicioFinDia();
            const { inicio: inicioMes, fin: finMes } = inicioFinMes();

            const cajaAbierta = await Caja.findOne({
                where: { estado: ESTADO_CAJA.ABIERTA },
                include: [
                    { model: User, as: 'usuarioApertura', attributes: ['id', 'username'] }
                ],
                order: [['id', 'DESC']]
            });

            const [movimientosHoy, ventasHoyRows, ventasPendientes, comprasPendientes] = await Promise.all([
                MovimientoCaja.findAll({
                    where: { fecha: { [Op.between]: [inicioDia, finDia] } },
                    include: [{ model: User, as: 'usuario', attributes: ['id', 'username'] }],
                    order: [['fecha', 'DESC'], ['id', 'DESC']]
                }),
                Venta.findAll({
                    where: {
                        fecha: { [Op.between]: [inicioDia, finDia] },
                        estado: { [Op.ne]: ESTADO_VENTA.ANULADA }
                    }
                }),
                Venta.findAll({
                    where: { estado: { [Op.in]: [ESTADO_VENTA.PENDIENTE, ESTADO_VENTA.PARCIAL] } },
                    include: [{ model: Cliente, as: 'cliente', attributes: ['id', 'nombre'] }],
                    order: [['fecha', 'DESC']],
                    limit: 8
                }),
                Compra.findAll({
                    where: { estado: { [Op.in]: [ESTADO_COMPRA.PENDIENTE, ESTADO_COMPRA.PARCIAL] } }
                })
            ]);

            const { ingresos: ingresosHoy, egresos: egresosHoy } = sumarPorTipo(movimientosHoy);
            const ventasHoy = roundMoney(ventasHoyRows.reduce((acc, v) => acc + toMoney(v.get('total')), 0));
            const cobradoHoy = roundMoney(
                movimientosHoy
                    .filter((m) => m.get('tipo') === TIPO_MOVIMIENTO.INGRESO && CATEGORIAS_COBRO.includes(m.get('categoria') as any))
                    .reduce((acc, m) => acc + toMoney(m.get('monto')), 0)
            );

            const porCobrarTotal = await Venta.sum('saldo_pendiente', {
                where: { estado: { [Op.in]: [ESTADO_VENTA.PENDIENTE, ESTADO_VENTA.PARCIAL] } }
            });
            const porPagarTotal = await Compra.sum('saldo_pendiente', {
                where: { estado: { [Op.in]: [ESTADO_COMPRA.PENDIENTE, ESTADO_COMPRA.PARCIAL] } }
            });

            const egresosPorTipo: Record<string, number> = {
                [CATEGORIA_EGRESO.PAGO_PROVEEDOR]: 0,
                [CATEGORIA_EGRESO.GASTO_EMPRESA]: 0,
                [CATEGORIA_EGRESO.RETIRO_PERSONAL]: 0,
                [CATEGORIA_EGRESO.OTRO_EGRESO]: 0
            };
            for (const movimiento of movimientosHoy) {
                if (movimiento.get('tipo') !== TIPO_MOVIMIENTO.EGRESO) {
                    continue;
                }
                const cat = String(movimiento.get('categoria'));
                egresosPorTipo[cat] = roundMoney((egresosPorTipo[cat] || 0) + toMoney(movimiento.get('monto')));
            }

            let saldoInicial = 0;
            let saldoEsperado = 0;
            if (cajaAbierta) {
                saldoInicial = toMoney(cajaAbierta.get('saldo_inicial'));
                const movimientosCaja = await MovimientoCaja.findAll({
                    where: { id_caja: cajaAbierta.get('id') as number }
                });
                const cajaTotales = sumarPorTipo(movimientosCaja);
                saldoEsperado = roundMoney(saldoInicial + cajaTotales.ingresos - cajaTotales.egresos);
            }

            const ingresosRecientes = movimientosHoy
                .filter((m) => m.get('tipo') === TIPO_MOVIMIENTO.INGRESO)
                .slice(0, 6)
                .map((m: any) => mapMovimiento(m));
            const egresosRecientes = movimientosHoy
                .filter((m) => m.get('tipo') === TIPO_MOVIMIENTO.EGRESO)
                .slice(0, 6)
                .map((m: any) => mapMovimiento(m));

            res.status(200).json({
                ventas_hoy: ventasHoy,
                cobrado_hoy: cobradoHoy,
                por_cobrar: roundMoney(Number(porCobrarTotal || 0)),
                por_pagar: roundMoney(Number(porPagarTotal || 0)),
                ingresos_hoy: ingresosHoy,
                egresos_hoy: egresosHoy,
                saldo_neto: roundMoney(ingresosHoy - egresosHoy),
                saldo_inicial: saldoInicial,
                saldo_esperado: saldoEsperado,
                egresos_por_tipo: egresosPorTipo,
                periodo: { inicio: inicioDia, fin: finDia, mes_inicio: inicioMes, mes_fin: finMes },
                caja: cajaAbierta
                    ? {
                        id: cajaAbierta.get('id'),
                        estado: cajaAbierta.get('estado'),
                        fecha_apertura: cajaAbierta.get('fecha_apertura'),
                        usuario_apertura: (cajaAbierta as any).usuarioApertura
                            ? {
                                id: (cajaAbierta as any).usuarioApertura.id,
                                username: (cajaAbierta as any).usuarioApertura.username
                            }
                            : null
                    }
                    : {
                        id: null,
                        estado: ESTADO_CAJA.CERRADA,
                        fecha_apertura: null,
                        usuario_apertura: null
                    },
                resultado_arqueo: clasificarDiferencia(0),
                cuentas_pendientes: ventasPendientes.map((venta: any) => ({
                    id: venta.id,
                    fecha: venta.fecha,
                    cliente: venta.cliente ? { id: venta.cliente.id, nombre: venta.cliente.nombre } : null,
                    total: toMoney(venta.total),
                    cobrado: roundMoney(toMoney(venta.total) - toMoney(venta.saldo_pendiente)),
                    pendiente: toMoney(venta.saldo_pendiente),
                    estado: venta.estado
                })),
                ingresos_recientes: ingresosRecientes,
                egresos_recientes: egresosRecientes,
                movimientos_recientes: movimientosHoy.slice(0, 8).map((movimiento: any) => mapMovimiento(movimiento))
            });
        } catch (error) {
            handleError(res, error, 'Error al obtener el resumen del dashboard');
        }
    }

    public static async movimientos(req: Request, res: Response): Promise<void> {
        try {
            const { inicio, fin } = rangoDesdeQuery(req.query.fecha_desde, req.query.fecha_hasta);
            const movimientos = await MovimientoCaja.findAll({
                where: { fecha: { [Op.between]: [inicio, fin] } },
                include: [{ model: User, as: 'usuario', attributes: ['id', 'username'] }],
                order: [['fecha', 'DESC'], ['id', 'DESC']]
            });

            const { ingresos, egresos } = sumarPorTipo(movimientos);
            const cobrado = roundMoney(
                movimientos
                    .filter((m) => m.get('tipo') === TIPO_MOVIMIENTO.INGRESO && CATEGORIAS_COBRO.includes(m.get('categoria') as any))
                    .reduce((acc, m) => acc + toMoney(m.get('monto')), 0)
            );
            const porCobrar = await Venta.sum('saldo_pendiente', {
                where: { estado: { [Op.in]: [ESTADO_VENTA.PENDIENTE, ESTADO_VENTA.PARCIAL] } }
            });

            res.status(200).json({
                fecha_desde: inicio,
                fecha_hasta: fin,
                total_ingresos: ingresos,
                total_egresos: egresos,
                saldo_neto: roundMoney(ingresos - egresos),
                cobrado,
                por_cobrar: roundMoney(Number(porCobrar || 0)),
                movimientos: movimientos.map((item: any) => mapMovimiento(item))
            });
        } catch (error) {
            handleError(res, error, 'Error al listar ingresos y egresos');
        }
    }
}
