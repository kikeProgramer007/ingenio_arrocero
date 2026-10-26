import { Request, Response } from 'express';
import { BitacoraVenta, CategoriaProducto, Productos, ReservaVenta, Venta, VentaDetalle, sequelize } from '../models';
import { estadoVentaPorSaldo } from '../constants/venta.constants';
import { ErrorDespacho, contadorReserva, reservarLinea } from '../servicios/despachos.servicio';
import { getAuthUser } from '../utils/auth-user';
import { resolverPlazoCredito } from '../utils/credito';
import { esProductoEmpaque } from '../utils/empaque';
import { aplicarStock, TIPO_INVENTARIO, toQty } from '../utils/inventario';
import { roundMoney, toMoney } from '../utils/money';
import { includesVenta, mapVenta } from '../controllers/venta.controller';
import { obtenerCajaAbierta } from '../utils/caja-ingreso';
import { handleError } from '../utils/error.handler';

interface LineaEdicion {
    id?: number;
    id_producto?: number | null;
    descripcion?: string;
    cantidad: number;
    precio_unitario: number;
}

export async function registrarBitacoraVenta(datos: {
    idVenta: number;
    idUsuario: number;
    idCaja: number | null;
    accion: string;
    motivo: string;
    anterior: unknown;
    nuevo: unknown;
    transaction?: any;
}): Promise<void> {
    await BitacoraVenta.create({
        id_venta: datos.idVenta,
        id_usuario: datos.idUsuario,
        id_caja: datos.idCaja,
        accion: datos.accion,
        motivo: datos.motivo.slice(0, 250),
        anterior: JSON.stringify(datos.anterior),
        nuevo: JSON.stringify(datos.nuevo),
        fecha: new Date()
    }, { transaction: datos.transaction });
}

function snapshotVenta(venta: any, detalles: any[]): unknown {
    return {
        total: toMoney(venta.get ? venta.get('total') : venta.total),
        saldo_pendiente: toMoney(venta.get ? venta.get('saldo_pendiente') : venta.saldo_pendiente),
        estado: venta.get ? venta.get('estado') : venta.estado,
        plazo_dias: venta.get ? venta.get('plazo_dias') : venta.plazo_dias,
        fecha_vencimiento: venta.get ? venta.get('fecha_vencimiento') : venta.fecha_vencimiento,
        lineas: detalles.map((d) => ({
            id: Number(d.get ? d.get('id') : d.id),
            id_producto: d.get ? d.get('id_producto') : d.id_producto,
            descripcion: d.get ? d.get('descripcion') : d.descripcion,
            cantidad: toQty(d.get ? d.get('cantidad') : d.cantidad),
            precio_unitario: toMoney(d.get ? d.get('precio_unitario') : d.precio_unitario),
            subtotal: toMoney(d.get ? d.get('subtotal') : d.subtotal)
        }))
    };
}

export async function editarVenta(req: Request, res: Response): Promise<void> {
    const usuario = getAuthUser(req);
    if (!usuario) {
        res.status(401).json({ mensaje: 'Usuario no autenticado' });
        return;
    }
    const motivo = String(req.body?.motivo || '').trim();
    if (!motivo) {
        res.status(400).json({ mensaje: 'Indique el motivo de la corrección' });
        return;
    }
    const lineasBody = Array.isArray(req.body?.lineas) ? req.body.lineas as LineaEdicion[] : [];
    if (!lineasBody.length) {
        res.status(400).json({ mensaje: 'La venta debe conservar al menos un producto' });
        return;
    }
    const transaction = await sequelize.transaction();
    try {
        const venta = await Venta.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
        if (!venta) {
            await transaction.rollback();
            res.status(404).json({ mensaje: 'Venta no encontrada' });
            return;
        }
        if (venta.get('estado') === 'ANULADA') {
            await transaction.rollback();
            res.status(409).json({ mensaje: 'No se puede editar una venta anulada' });
            return;
        }
        const cajaAbierta = await obtenerCajaAbierta(transaction);
        const idCajaVenta = Number(venta.get('id_caja') || 0);
        if (!cajaAbierta || !idCajaVenta || Number(cajaAbierta.get('id')) !== idCajaVenta) {
            await transaction.rollback();
            res.status(409).json({ mensaje: 'Solo se puede editar mientras la caja en que se registró la venta siga abierta' });
            return;
        }
        const idVenta = Number(venta.get('id'));
        const detalles = await VentaDetalle.findAll({ where: { id_venta: idVenta }, transaction, lock: transaction.LOCK.UPDATE });
        const reservas = await ReservaVenta.findAll({ where: { id_venta: idVenta }, transaction, lock: transaction.LOCK.UPDATE });
        const anterior = snapshotVenta(venta, detalles);
        const idsConservados = new Set<number>();

        for (const linea of lineasBody) {
            const cantidad = toQty(linea.cantidad);
            const precio = toMoney(linea.precio_unitario);
            if (!(cantidad > 0) || precio < 0) {
                await transaction.rollback();
                res.status(400).json({ mensaje: 'Cada producto necesita cantidad mayor a cero y precio válido' });
                return;
            }
            const idDetalle = Number(linea.id || 0);
            if (idDetalle) {
                const detalle = detalles.find((d) => Number(d.get('id')) === idDetalle);
                if (!detalle) {
                    await transaction.rollback();
                    res.status(400).json({ mensaje: 'Una línea no pertenece a esta venta' });
                    return;
                }
                idsConservados.add(idDetalle);
                const reserva = reservas.find((r) => Number(r.get('id_detalle')) === idDetalle);
                const anteriorCantidad = toQty(detalle.get('cantidad'));
                const entregado = reserva ? toQty(reserva.get('entregado')) : anteriorCantidad;
                if (cantidad + 0.0001 < entregado) {
                    await transaction.rollback();
                    res.status(409).json({ mensaje: 'No se puede bajar la cantidad por debajo de lo ya entregado' });
                    return;
                }
                if (reserva) {
                    const pendiente = toQty(reserva.get('pendiente'));
                    const pendienteNuevo = toQty(cantidad - entregado);
                    const delta = toQty(pendienteNuevo - pendiente);
                    if (delta > 0) {
                        const idProducto = Number(reserva.get('id_producto'));
                        const producto = await Productos.findByPk(idProducto, { transaction, lock: transaction.LOCK.UPDATE });
                        const contador = await contadorReserva(idProducto, transaction);
                        const disponible = toQty(Number(producto?.get('stock') || 0) - Number(contador.get('cantidad')));
                        if (delta > disponible) {
                            await transaction.rollback();
                            res.status(409).json({ mensaje: `No hay stock suficiente para aumentar ${detalle.get('descripcion')}` });
                            return;
                        }
                        await contador.update({ cantidad: toQty(Number(contador.get('cantidad')) + delta) }, { transaction });
                    } else if (delta < 0) {
                        const idProducto = Number(reserva.get('id_producto'));
                        const contador = await contadorReserva(idProducto, transaction);
                        await contador.update({ cantidad: toQty(Number(contador.get('cantidad')) + delta) }, { transaction });
                    }
                    await reserva.update({ vendido: cantidad, pendiente: toQty(cantidad - entregado) }, { transaction });
                } else if (cantidad > anteriorCantidad) {
                    const idProducto = Number(detalle.get('id_producto') || 0);
                    if (idProducto) {
                        const stock = await aplicarStock({
                            transaction,
                            idProducto,
                            delta: -(cantidad - anteriorCantidad),
                            tipo: TIPO_INVENTARIO.SALIDA,
                            origen: 'VENTA',
                            origenId: idVenta,
                            idUsuario: usuario.id,
                            observacion: `Aumento en edición de venta #${idVenta}`
                        });
                        if (!stock.ok) {
                            await transaction.rollback();
                            res.status(409).json({ mensaje: stock.mensaje });
                            return;
                        }
                    }
                } else if (cantidad < anteriorCantidad) {
                    await transaction.rollback();
                    res.status(409).json({ mensaje: 'No se puede bajar la cantidad por debajo de lo ya entregado' });
                    return;
                }
                const subtotal = roundMoney(cantidad * precio);
                await detalle.update({
                    cantidad,
                    precio_unitario: precio,
                    subtotal,
                    descripcion: String(linea.descripcion || detalle.get('descripcion')).slice(0, 200)
                }, { transaction });
                continue;
            }

            const idProducto = Number(linea.id_producto || 0);
            let descripcion = String(linea.descripcion || '').trim();
            if (idProducto) {
                const producto = await Productos.findByPk(idProducto, {
                    transaction,
                    lock: transaction.LOCK.UPDATE,
                    include: [{ model: CategoriaProducto, as: 'categoria', attributes: ['id', 'nombre'] }]
                });
                if (!producto || producto.get('eliminado')) {
                    await transaction.rollback();
                    res.status(400).json({ mensaje: 'Producto inexistente o inactivo' });
                    return;
                }
                if (!descripcion) {
                    descripcion = String(producto.get('nombre'));
                }
                if (esProductoEmpaque({ nombre: producto.get('nombre'), categoria: (producto as any).categoria })) {
                    await transaction.rollback();
                    res.status(400).json({ mensaje: 'Las bolsas y empaques no se venden' });
                    return;
                }
            }
            if (!descripcion) {
                await transaction.rollback();
                res.status(400).json({ mensaje: 'Indique la descripción del producto' });
                return;
            }
            const creado = await VentaDetalle.create({
                id_venta: idVenta,
                id_producto: idProducto || null,
                descripcion: descripcion.slice(0, 200),
                cantidad,
                precio_unitario: precio,
                subtotal: roundMoney(cantidad * precio)
            }, { transaction });
            if (idProducto && reservas.length) {
                await reservarLinea(creado, transaction);
            } else if (idProducto) {
                const stock = await aplicarStock({
                    transaction,
                    idProducto,
                    delta: -cantidad,
                    tipo: TIPO_INVENTARIO.SALIDA,
                    origen: 'VENTA',
                    origenId: idVenta,
                    idUsuario: usuario.id,
                    observacion: `Línea nueva en venta #${idVenta}`
                });
                if (!stock.ok) {
                    await transaction.rollback();
                    res.status(409).json({ mensaje: stock.mensaje });
                    return;
                }
            }
        }

        for (const detalle of detalles) {
            const idDetalle = Number(detalle.get('id'));
            if (idsConservados.has(idDetalle)) {
                continue;
            }
            const reserva = reservas.find((r) => Number(r.get('id_detalle')) === idDetalle);
            const entregado = reserva ? toQty(reserva.get('entregado')) : toQty(detalle.get('cantidad'));
            if (entregado > 0) {
                await transaction.rollback();
                res.status(409).json({ mensaje: 'No se puede quitar un producto ya entregado' });
                return;
            }
            if (reserva) {
                const contador = await contadorReserva(Number(reserva.get('id_producto')), transaction);
                await contador.update({
                    cantidad: toQty(Number(contador.get('cantidad')) - toQty(reserva.get('pendiente')))
                }, { transaction });
                await reserva.destroy({ transaction });
            }
            await detalle.destroy({ transaction });
        }

        const vigentes = await VentaDetalle.findAll({ where: { id_venta: idVenta }, transaction });
        if (!vigentes.length) {
            await transaction.rollback();
            res.status(400).json({ mensaje: 'La venta debe conservar al menos un producto' });
            return;
        }
        const total = roundMoney(vigentes.reduce((acc, d) => acc + toMoney(d.get('subtotal')), 0));
        const totalAnterior = toMoney(venta.get('total'));
        const saldoAnterior = toMoney(venta.get('saldo_pendiente'));
        const cobrado = roundMoney(totalAnterior - saldoAnterior);
        if (total + 0.001 < cobrado) {
            await transaction.rollback();
            res.status(409).json({ mensaje: 'El nuevo total no puede ser menor a lo ya cobrado. No se devuelve dinero al editar.' });
            return;
        }
        const saldoNuevo = roundMoney(total - cobrado);
        if (saldoNuevo > 0 && saldoAnterior <= 0 && !req.body?.a_credito) {
            await transaction.rollback();
            res.status(409).json({ mensaje: 'El contado queda por encima de lo cobrado. Cobre la diferencia o pase la venta a crédito con plazo.' });
            return;
        }
        const fechaEnviada = req.body?.fecha_vencimiento ? String(req.body.fecha_vencimiento) : '';
        const diasEnviados = req.body?.plazo_dias != null && req.body.plazo_dias !== '' ? Number(req.body.plazo_dias) : 0;
        const plazo = saldoNuevo <= 0
            ? resolverPlazoCredito(0)
            : (fechaEnviada || diasEnviados || saldoAnterior <= 0 || !venta.get('fecha_vencimiento'))
                ? resolverPlazoCredito(saldoNuevo, diasEnviados || undefined, fechaEnviada || undefined, true)
                : { ok: true as const, plazo_dias: venta.get('plazo_dias') != null ? Number(venta.get('plazo_dias')) : null, fecha_vencimiento: String(venta.get('fecha_vencimiento')) };
        if (!plazo.ok) {
            await transaction.rollback();
            res.status(400).json({ mensaje: plazo.mensaje });
            return;
        }
        await venta.update({
            total,
            saldo_pendiente: saldoNuevo,
            estado: estadoVentaPorSaldo(total, saldoNuevo),
            plazo_dias: plazo.plazo_dias,
            fecha_vencimiento: plazo.fecha_vencimiento
        }, { transaction });
        await registrarBitacoraVenta({
            idVenta,
            idUsuario: usuario.id,
            idCaja: idCajaVenta,
            accion: 'EDICION',
            motivo,
            anterior,
            nuevo: snapshotVenta(venta, vigentes),
            transaction
        });
        await transaction.commit();
        const actualizada = await Venta.findByPk(idVenta, { include: includesVenta });
        res.status(200).json({ mensaje: 'Venta actualizada', data: mapVenta(actualizada) });
    } catch (error) {
        await transaction.rollback();
        if (error instanceof ErrorDespacho) {
            res.status(error.status).json({ mensaje: error.message });
            return;
        }
        handleError(res, error, 'Error al editar la venta');
    }
}
