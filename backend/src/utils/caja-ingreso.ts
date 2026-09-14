import { Transaction } from 'sequelize';
import { Caja } from '../models/caja.model';
import { MovimientoCaja } from '../models/movimiento-caja.model';
import { ESTADO_CAJA, TIPO_MOVIMIENTO } from '../constants/caja.constants';
import { toMoney } from './money';

type MovimientoCajaParams = {
    transaction: Transaction;
    idCaja: number;
    idUsuario: number;
    categoria: string;
    concepto: string;
    monto: number;
    metodoPago: string;
    referencia?: string | null;
    observacion?: string | null;
    origen: string;
    origenId: number;
};

export async function obtenerCajaAbierta(transaction: Transaction) {
    return Caja.findOne({
        where: { estado: ESTADO_CAJA.ABIERTA },
        transaction,
        lock: transaction.LOCK.UPDATE
    });
}

async function registrarMovimientoCaja(params: MovimientoCajaParams & { tipo: string }) {
    return MovimientoCaja.create({
        id_caja: params.idCaja,
        tipo: params.tipo,
        categoria: params.categoria,
        concepto: params.concepto,
        monto: toMoney(params.monto),
        metodo_pago: params.metodoPago,
        referencia: params.referencia || null,
        observacion: params.observacion || null,
        origen: params.origen,
        origen_id: params.origenId,
        id_usuario: params.idUsuario,
        fecha: new Date()
    }, { transaction: params.transaction });
}

export async function registrarIngresoCaja(params: MovimientoCajaParams) {
    return registrarMovimientoCaja({ ...params, tipo: TIPO_MOVIMIENTO.INGRESO });
}

export async function registrarEgresoCaja(params: MovimientoCajaParams) {
    return registrarMovimientoCaja({ ...params, tipo: TIPO_MOVIMIENTO.EGRESO });
}
