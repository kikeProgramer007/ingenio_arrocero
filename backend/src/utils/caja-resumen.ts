import { CATEGORIA_EGRESO, CATEGORIA_INGRESO, TIPO_MOVIMIENTO } from '../constants/caja.constants';
import { roundMoney, toMoney } from './money';
import { canalMetodo } from './metodo-pago';

export const CATEGORIAS_COBRO_CLIENTE = [CATEGORIA_INGRESO.VENTA, CATEGORIA_INGRESO.COBRANZA];

export interface DesgloseMovimientos {
    ingresos: number;
    egresos: number;
    cobros_clientes: number;
    anulaciones_venta: number;
    cobrado_neto: number;
    otros_ingresos: number;
    pagos_proveedor: number;
    gastos_empresa: number;
    retiros: number;
    otros_egresos: number;
    efectivo_ingresos: number;
    efectivo_egresos: number;
    qr_ingresos: number;
    qr_egresos: number;
}

function campo(movimiento: any, key: string) {
    return movimiento?.get ? movimiento.get(key) : movimiento?.[key];
}

/**
 * Libro de caja: el cobro original no se borra; la anulación es un egreso.
 * cobrado_neto = cobros de clientes − devoluciones por anulación.
 */
export function resumirMovimientos(movimientos: any[]): DesgloseMovimientos {
    let cobrosClientes = 0;
    let anulacionesVenta = 0;
    let otrosIngresos = 0;
    let pagosProveedor = 0;
    let gastosEmpresa = 0;
    let retiros = 0;
    let otrosEgresos = 0;
    let efectivoIngresos = 0;
    let efectivoEgresos = 0;
    let qrIngresos = 0;
    let qrEgresos = 0;
    let ingresos = 0;
    let egresos = 0;

    for (const movimiento of movimientos) {
        const monto = toMoney(campo(movimiento, 'monto'));
        const tipo = campo(movimiento, 'tipo');
        const categoria = String(campo(movimiento, 'categoria') || '');
        const canal = canalMetodo(campo(movimiento, 'metodo_pago'));
        if (tipo === TIPO_MOVIMIENTO.INGRESO) {
            ingresos += monto;
            if (canal === 'EFECTIVO') {
                efectivoIngresos += monto;
            } else {
                qrIngresos += monto;
            }
            if (CATEGORIAS_COBRO_CLIENTE.includes(categoria as any)) {
                cobrosClientes += monto;
            } else {
                otrosIngresos += monto;
            }
        } else {
            egresos += monto;
            if (canal === 'EFECTIVO') {
                efectivoEgresos += monto;
            } else {
                qrEgresos += monto;
            }
            if (categoria === CATEGORIA_EGRESO.PAGO_PROVEEDOR) {
                pagosProveedor += monto;
            } else if (categoria === CATEGORIA_EGRESO.GASTO_EMPRESA) {
                gastosEmpresa += monto;
            } else if (categoria === CATEGORIA_EGRESO.RETIRO_PERSONAL) {
                retiros += monto;
            } else if (categoria === CATEGORIA_EGRESO.ANULACION_VENTA) {
                anulacionesVenta += monto;
            } else {
                otrosEgresos += monto;
            }
        }
    }

    cobrosClientes = roundMoney(cobrosClientes);
    anulacionesVenta = roundMoney(anulacionesVenta);
    return {
        ingresos: roundMoney(ingresos),
        egresos: roundMoney(egresos),
        cobros_clientes: cobrosClientes,
        anulaciones_venta: anulacionesVenta,
        cobrado_neto: roundMoney(cobrosClientes - anulacionesVenta),
        otros_ingresos: roundMoney(otrosIngresos),
        pagos_proveedor: roundMoney(pagosProveedor),
        gastos_empresa: roundMoney(gastosEmpresa),
        retiros: roundMoney(retiros),
        otros_egresos: roundMoney(otrosEgresos),
        efectivo_ingresos: roundMoney(efectivoIngresos),
        efectivo_egresos: roundMoney(efectivoEgresos),
        qr_ingresos: roundMoney(qrIngresos),
        qr_egresos: roundMoney(qrEgresos)
    };
}
