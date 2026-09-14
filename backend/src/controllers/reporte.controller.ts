import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Acopio, Compra, Gasto, MovimientoCaja, Venta } from '../models';
import { handleError } from '../utils/error.handler';
import { roundMoney, toMoney } from '../utils/money';
import { TIPO_MOVIMIENTO } from '../constants/caja.constants';

function rango(req: Request) {
    const desde = typeof req.query.fecha_desde === 'string' && req.query.fecha_desde
        ? new Date(`${req.query.fecha_desde}T00:00:00`)
        : (() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; })();
    const hasta = typeof req.query.fecha_hasta === 'string' && req.query.fecha_hasta
        ? new Date(`${req.query.fecha_hasta}T23:59:59`)
        : new Date();
    return { desde, hasta };
}

export class ReporteController {
    public static async resumen(req: Request, res: Response): Promise<void> {
        try {
            const { desde, hasta } = rango(req);
            const filtro = { fecha: { [Op.between]: [desde, hasta] } };

            const [ventas, compras, gastos, acopios, movimientos] = await Promise.all([
                Venta.findAll({ where: filtro }),
                Compra.findAll({ where: filtro }),
                Gasto.findAll({ where: filtro }),
                Acopio.findAll({ where: filtro }),
                MovimientoCaja.findAll({ where: filtro })
            ]);

            const totalVentas = roundMoney(ventas.reduce((acc, v) => acc + toMoney(v.get('total')), 0));
            const cobrado = roundMoney(ventas.reduce((acc, v) => acc + toMoney(v.get('total')) - toMoney(v.get('saldo_pendiente')), 0));
            const porCobrar = roundMoney(ventas.reduce((acc, v) => acc + toMoney(v.get('saldo_pendiente')), 0));
            const totalCompras = roundMoney(compras.reduce((acc, c) => acc + toMoney(c.get('total')), 0));
            const porPagar = roundMoney(compras.reduce((acc, c) => acc + toMoney(c.get('saldo_pendiente')), 0));
            const totalGastos = roundMoney(gastos.filter((g) => g.get('tipo') === 'GASTO_EMPRESA').reduce((acc, g) => acc + toMoney(g.get('monto')), 0));
            const totalRetiros = roundMoney(gastos.filter((g) => g.get('tipo') === 'RETIRO_PERSONAL').reduce((acc, g) => acc + toMoney(g.get('monto')), 0));
            const totalAcopio = roundMoney(acopios.reduce((acc, a) => acc + toMoney(a.get('total')), 0));
            let ingresosCaja = 0;
            let egresosCaja = 0;
            for (const m of movimientos) {
                const monto = toMoney(m.get('monto'));
                if (m.get('tipo') === TIPO_MOVIMIENTO.INGRESO) ingresosCaja += monto;
                else egresosCaja += monto;
            }

            res.status(200).json({
                fecha_desde: desde,
                fecha_hasta: hasta,
                ventas: { cantidad: ventas.length, total: totalVentas, cobrado, por_cobrar: porCobrar },
                compras: { cantidad: compras.length, total: totalCompras, por_pagar: porPagar },
                gastos: totalGastos,
                retiros: totalRetiros,
                acopios: { cantidad: acopios.length, total: totalAcopio },
                caja: { ingresos: roundMoney(ingresosCaja), egresos: roundMoney(egresosCaja) }
            });
        } catch (error) {
            handleError(res, error, 'Error al generar el reporte');
        }
    }
}
