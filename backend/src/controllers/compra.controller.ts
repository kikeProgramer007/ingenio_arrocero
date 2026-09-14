import { Request, Response } from 'express';
import { Compra, CompraDetalle, PagoProveedor, Productos, Proveedor, sequelize, User } from '../models';
import { handleError } from '../utils/error.handler';
import { DtoValidator } from '../utils/dto.validador';
import { getAuthUser } from '../utils/auth-user';
import { roundMoney, toMoney } from '../utils/money';
import { obtenerCajaAbierta, registrarEgresoCaja } from '../utils/caja-ingreso';
import { aplicarStock, TIPO_INVENTARIO } from '../utils/inventario';
import { CATEGORIA_EGRESO, ORIGEN_MOVIMIENTO } from '../constants/caja.constants';
import { ESTADO_COMPRA, estadoCompraPorSaldo } from '../constants/compra.constants';
import { CrearCompraDTO, CrearPagoProveedorDTO } from '../dtos/compra.dto';

const usuarioAtributos = ['id', 'username'];

function mapLinea(detalle: any) {
    return {
        id: detalle.id,
        descripcion: detalle.descripcion,
        id_producto: detalle.id_producto,
        cantidad: Number(detalle.cantidad),
        precio_unitario: toMoney(detalle.precio_unitario),
        subtotal: toMoney(detalle.subtotal)
    };
}

function mapPago(item: any) {
    return {
        id: item.id,
        id_compra: item.id_compra,
        id_proveedor: item.id_proveedor,
        id_caja: item.id_caja,
        monto: toMoney(item.monto),
        metodo_pago: item.metodo_pago,
        referencia: item.referencia,
        observacion: item.observacion,
        fecha: item.fecha,
        proveedor: item.proveedor ? { id: item.proveedor.id, nombre: item.proveedor.nombre } : null,
        compra: item.compra
            ? {
                id: item.compra.id,
                total: toMoney(item.compra.total),
                saldo_pendiente: toMoney(item.compra.saldo_pendiente),
                pagado: roundMoney(toMoney(item.compra.total) - toMoney(item.compra.saldo_pendiente)),
                estado: item.compra.estado
            }
            : null,
        usuario: item.usuario ? { id: item.usuario.id, username: item.usuario.username } : null
    };
}

function mapCompra(compra: any) {
    const total = toMoney(compra.total);
    const saldo = toMoney(compra.saldo_pendiente);
    return {
        id: compra.id,
        id_proveedor: compra.id_proveedor,
        fecha: compra.fecha,
        total,
        saldo_pendiente: saldo,
        pagado: roundMoney(total - saldo),
        estado: compra.estado,
        observacion: compra.observacion,
        proveedor: compra.proveedor ? { id: compra.proveedor.id, nombre: compra.proveedor.nombre } : null,
        usuario: compra.usuario ? { id: compra.usuario.id, username: compra.usuario.username } : null,
        detalles: (compra.detalles || []).map(mapLinea),
        pagos: (compra.pagos || []).map(mapPago)
    };
}

const includesCompra = [
    { model: Proveedor, as: 'proveedor', attributes: ['id', 'nombre'] },
    { model: User, as: 'usuario', attributes: usuarioAtributos },
    { model: CompraDetalle, as: 'detalles' },
    { model: PagoProveedor, as: 'pagos' }
];

export class CompraController {
    public static async listar(req: Request, res: Response): Promise<void> {
        try {
            const where: any = {};
            const { estado, id_proveedor } = req.query;
            if (typeof estado === 'string' && estado) {
                where.estado = estado;
            }
            if (typeof id_proveedor === 'string' && id_proveedor) {
                where.id_proveedor = Number(id_proveedor);
            }
            const compras = await Compra.findAll({
                where,
                include: includesCompra,
                order: [['fecha', 'DESC'], ['id', 'DESC']]
            });
            res.status(200).json(compras.map(mapCompra));
        } catch (error) {
            handleError(res, error, 'Error al listar compras');
        }
    }

    public static async obtener(req: Request, res: Response): Promise<void> {
        try {
            const compra = await Compra.findByPk(req.params.id, { include: includesCompra });
            if (!compra) {
                res.status(404).json({ mensaje: `No se encontró la compra con ID ${req.params.id}` });
                return;
            }
            res.status(200).json(mapCompra(compra));
        } catch (error) {
            handleError(res, error, 'Error al obtener la compra');
        }
    }

    public static async crear(req: Request, res: Response): Promise<void> {
        const usuario = getAuthUser(req);
        if (!usuario) {
            res.status(401).json({ mensaje: 'Usuario no autenticado' });
            return;
        }
        const datos = await DtoValidator.validateAndRespond(CrearCompraDTO, req.body, res);
        if (!datos) {
            return;
        }

        const pagoInicial = toMoney(datos.pago_inicial || 0);
        const lineas = datos.lineas.map((linea) => {
            const cantidad = Number(linea.cantidad);
            const precio = toMoney(linea.precio_unitario);
            const subtotal = roundMoney(cantidad * precio);
            return {
                descripcion: (linea.descripcion || '').trim(),
                cantidad,
                precio_unitario: precio,
                subtotal,
                id_producto: linea.id_producto || null
            };
        });
        const total = roundMoney(lineas.reduce((acc, linea) => acc + linea.subtotal, 0));
        if (total <= 0) {
            res.status(400).json({ mensaje: 'El total de la compra debe ser mayor a 0' });
            return;
        }
        if (pagoInicial > total) {
            res.status(400).json({ mensaje: 'El pago inicial no puede ser mayor al total' });
            return;
        }

        const transaction = await sequelize.transaction();
        try {
            const proveedor = await Proveedor.findByPk(datos.id_proveedor, { transaction });
            if (!proveedor || !proveedor.get('activo')) {
                await transaction.rollback();
                res.status(400).json({ mensaje: 'El proveedor no existe o está inactivo' });
                return;
            }

            let cajaAbierta = null;
            if (pagoInicial > 0) {
                cajaAbierta = await obtenerCajaAbierta(transaction);
                if (!cajaAbierta) {
                    await transaction.rollback();
                    res.status(409).json({ mensaje: 'Debe haber una caja abierta para registrar un pago' });
                    return;
                }
            }

            const saldoPendiente = roundMoney(total - pagoInicial);
            const compra = await Compra.create({
                id_proveedor: datos.id_proveedor,
                fecha: new Date(),
                total,
                saldo_pendiente: saldoPendiente,
                estado: estadoCompraPorSaldo(total, saldoPendiente),
                observacion: datos.observacion?.trim() || null,
                id_usuario: usuario.id
            }, { transaction });

            const idCompra = compra.get('id') as number;
            for (const linea of lineas) {
                if (linea.id_producto && !linea.descripcion) {
                    const producto = await Productos.findByPk(linea.id_producto, { transaction });
                    linea.descripcion = producto ? String(producto.get('nombre')) : 'Producto';
                }
                await CompraDetalle.create({ ...linea, id_compra: idCompra }, { transaction });
                if (linea.id_producto) {
                    const stock = await aplicarStock({
                        transaction,
                        idProducto: linea.id_producto,
                        delta: linea.cantidad,
                        tipo: TIPO_INVENTARIO.ENTRADA,
                        origen: 'COMPRA',
                        origenId: idCompra,
                        idUsuario: usuario.id,
                        observacion: linea.descripcion
                    });
                    if (!stock.ok) {
                        await transaction.rollback();
                        res.status(409).json({ mensaje: stock.mensaje });
                        return;
                    }
                }
            }

            if (pagoInicial > 0 && cajaAbierta) {
                const idCaja = cajaAbierta.get('id') as number;
                const pago = await PagoProveedor.create({
                    id_compra: idCompra,
                    id_proveedor: datos.id_proveedor,
                    id_caja: idCaja,
                    monto: pagoInicial,
                    metodo_pago: datos.metodo_pago,
                    referencia: datos.referencia || null,
                    observacion: 'Pago al registrar la compra',
                    fecha: new Date(),
                    id_usuario: usuario.id
                }, { transaction });

                await registrarEgresoCaja({
                    transaction,
                    idCaja,
                    idUsuario: usuario.id,
                    categoria: CATEGORIA_EGRESO.PAGO_PROVEEDOR,
                    concepto: `Compra #${idCompra} - ${proveedor.get('nombre')}`,
                    monto: pagoInicial,
                    metodoPago: datos.metodo_pago!,
                    referencia: datos.referencia || null,
                    origen: ORIGEN_MOVIMIENTO.COMPRA,
                    origenId: pago.get('id') as number
                });
            }

            await transaction.commit();
            const creada = await Compra.findByPk(idCompra, { include: includesCompra });
            res.status(201).json({ mensaje: 'Compra registrada', data: mapCompra(creada) });
        } catch (error) {
            await transaction.rollback();
            handleError(res, error, 'Error al registrar la compra');
        }
    }
}

export class PagoProveedorController {
    public static async listar(req: Request, res: Response): Promise<void> {
        try {
            const where: any = {};
            if (typeof req.query.id_compra === 'string' && req.query.id_compra) {
                where.id_compra = Number(req.query.id_compra);
            }
            if (typeof req.query.id_proveedor === 'string' && req.query.id_proveedor) {
                where.id_proveedor = Number(req.query.id_proveedor);
            }
            const pagos = await PagoProveedor.findAll({
                where,
                include: [
                    { model: Proveedor, as: 'proveedor', attributes: ['id', 'nombre'] },
                    { model: Compra, as: 'compra', attributes: ['id', 'total', 'saldo_pendiente', 'estado'] },
                    { model: User, as: 'usuario', attributes: usuarioAtributos }
                ],
                order: [['fecha', 'DESC'], ['id', 'DESC']]
            });
            res.status(200).json(pagos.map(mapPago));
        } catch (error) {
            handleError(res, error, 'Error al listar pagos');
        }
    }

    public static async crear(req: Request, res: Response): Promise<void> {
        const usuario = getAuthUser(req);
        if (!usuario) {
            res.status(401).json({ mensaje: 'Usuario no autenticado' });
            return;
        }
        const datos = await DtoValidator.validateAndRespond(CrearPagoProveedorDTO, req.body, res);
        if (!datos) {
            return;
        }
        const monto = toMoney(datos.monto);

        const transaction = await sequelize.transaction();
        try {
            const compra = await Compra.findByPk(datos.id_compra, {
                include: [{ model: Proveedor, as: 'proveedor' }],
                transaction,
                lock: transaction.LOCK.UPDATE
            });
            if (!compra) {
                await transaction.rollback();
                res.status(404).json({ mensaje: `No se encontró la compra con ID ${datos.id_compra}` });
                return;
            }
            const estado = compra.get('estado') as string;
            if (estado === ESTADO_COMPRA.ANULADA || estado === ESTADO_COMPRA.PAGADA) {
                await transaction.rollback();
                res.status(409).json({ mensaje: 'Esta compra no admite pagos' });
                return;
            }
            const saldo = toMoney(compra.get('saldo_pendiente'));
            if (monto > saldo) {
                await transaction.rollback();
                res.status(400).json({ mensaje: `El monto supera el saldo pendiente (${saldo})` });
                return;
            }

            const cajaAbierta = await obtenerCajaAbierta(transaction);
            if (!cajaAbierta) {
                await transaction.rollback();
                res.status(409).json({ mensaje: 'Debe haber una caja abierta para registrar un pago' });
                return;
            }

            const saldoNuevo = roundMoney(saldo - monto);
            const total = toMoney(compra.get('total'));
            await compra.update({
                saldo_pendiente: saldoNuevo,
                estado: estadoCompraPorSaldo(total, saldoNuevo)
            }, { transaction });

            const idCaja = cajaAbierta.get('id') as number;
            const idProveedor = compra.get('id_proveedor') as number;
            const pago = await PagoProveedor.create({
                id_compra: datos.id_compra,
                id_proveedor: idProveedor,
                id_caja: idCaja,
                monto,
                metodo_pago: datos.metodo_pago,
                referencia: datos.referencia || null,
                observacion: datos.observacion || null,
                fecha: new Date(),
                id_usuario: usuario.id
            }, { transaction });

            const nombreProveedor = (compra as any).proveedor?.nombre || 'Proveedor';
            await registrarEgresoCaja({
                transaction,
                idCaja,
                idUsuario: usuario.id,
                categoria: CATEGORIA_EGRESO.PAGO_PROVEEDOR,
                concepto: `Pago compra #${datos.id_compra} - ${nombreProveedor}`,
                monto,
                metodoPago: datos.metodo_pago,
                referencia: datos.referencia || null,
                observacion: datos.observacion || null,
                origen: ORIGEN_MOVIMIENTO.PAGO_PROVEEDOR,
                origenId: pago.get('id') as number
            });

            await transaction.commit();
            const creado = await PagoProveedor.findByPk(pago.get('id') as number, {
                include: [
                    { model: Proveedor, as: 'proveedor', attributes: ['id', 'nombre'] },
                    { model: Compra, as: 'compra', attributes: ['id', 'total', 'saldo_pendiente', 'estado'] },
                    { model: User, as: 'usuario', attributes: usuarioAtributos }
                ]
            });
            res.status(201).json({ mensaje: 'Pago registrado', data: mapPago(creado) });
        } catch (error) {
            await transaction.rollback();
            handleError(res, error, 'Error al registrar el pago');
        }
    }
}
