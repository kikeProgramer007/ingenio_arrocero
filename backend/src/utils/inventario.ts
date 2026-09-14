import { Transaction } from 'sequelize';
import { MovimientoInventario, TIPO_INVENTARIO } from '../models/movimiento-inventario.model';
import { Productos } from '../models/productos.model';

function toQty(value: unknown): number {
    const n = typeof value === 'string' ? parseFloat(value) : Number(value);
    if (!Number.isFinite(n)) {
        return 0;
    }
    return Math.round(n * 1000) / 1000;
}

export async function aplicarStock(params: {
    transaction: Transaction;
    idProducto: number;
    delta: number;
    tipo: string;
    origen: string;
    origenId: number | null;
    idUsuario: number;
    observacion?: string | null;
}): Promise<{ ok: true } | { ok: false; mensaje: string }> {
    const producto = await Productos.findOne({
        where: { id: params.idProducto, eliminado: false },
        transaction: params.transaction,
        lock: params.transaction.LOCK.UPDATE
    });
    if (!producto) {
        return { ok: false, mensaje: `No se encontró el producto ${params.idProducto}` };
    }
    const actual = toQty(producto.get('stock'));
    const nuevo = toQty(actual + params.delta);
    if (nuevo < 0) {
        return { ok: false, mensaje: `Stock insuficiente de ${producto.get('nombre')} (disponible ${actual})` };
    }
    await producto.update({ stock: nuevo }, { transaction: params.transaction });
    await MovimientoInventario.create({
        id_producto: params.idProducto,
        tipo: params.tipo,
        cantidad: toQty(Math.abs(params.delta)),
        stock_resultante: nuevo,
        origen: params.origen,
        origen_id: params.origenId,
        observacion: params.observacion || null,
        id_usuario: params.idUsuario,
        fecha: new Date()
    }, { transaction: params.transaction });
    return { ok: true };
}

export { TIPO_INVENTARIO, toQty };
