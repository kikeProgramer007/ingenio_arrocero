import { Request, Response } from 'express';
import { Cliente, Cobranza, Productos, sequelize, User, Venta, VentaDetalle } from '../models';
import { handleError } from '../utils/error.handler';
import { DtoValidator } from '../utils/dto.validador';
import { getAuthUser } from '../utils/auth-user';
import { roundMoney, toMoney } from '../utils/money';
import { obtenerCajaAbierta, registrarIngresoCaja } from '../utils/caja-ingreso';
import { aplicarStock, TIPO_INVENTARIO } from '../utils/inventario';
import { CATEGORIA_INGRESO, ORIGEN_MOVIMIENTO } from '../constants/caja.constants';
import { ESTADO_VENTA, estadoVentaPorSaldo } from '../constants/venta.constants';
import { CrearCobranzaDTO, CrearVentaDTO } from '../dtos/venta.dto';

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

function mapVenta(venta: any) {
    const total = toMoney(venta.total);
    const saldo = toMoney(venta.saldo_pendiente);
    return {
        id: venta.id,
        id_cliente: venta.id_cliente,
        fecha: venta.fecha,
        total,
        saldo_pendiente: saldo,
        pagado: roundMoney(total - saldo),
        estado: venta.estado,
        observacion: venta.observacion,
        cliente: venta.cliente ? { id: venta.cliente.id, nombre: venta.cliente.nombre } : null,
        usuario: venta.usuario ? { id: venta.usuario.id, username: venta.usuario.username } : null,
        detalles: (venta.detalles || []).map(mapLinea),
        cobranzas: (venta.cobranzas || []).map(mapCobranza)
    };
}

function mapCobranza(item: any) {
    return {
        id: item.id,
        id_venta: item.id_venta,
        id_cliente: item.id_cliente,
        id_caja: item.id_caja,
        monto: toMoney(item.monto),
        metodo_pago: item.metodo_pago,
        referencia: item.referencia,
        observacion: item.observacion,
        fecha: item.fecha,
        cliente: item.cliente ? { id: item.cliente.id, nombre: item.cliente.nombre } : null,
        venta: item.venta ? { id: item.venta.id, total: toMoney(item.venta.total), saldo_pendiente: toMoney(item.venta.saldo_pendiente), estado: item.venta.estado } : null,
        usuario: item.usuario ? { id: item.usuario.id, username: item.usuario.username } : null
    };
}

const includesVenta = [
    { model: Cliente, as: 'cliente', attributes: ['id', 'nombre'] },
    { model: User, as: 'usuario', attributes: usuarioAtributos },
    { model: VentaDetalle, as: 'detalles' },
    { model: Cobranza, as: 'cobranzas' }
];

export class VentaController {
    public static async listar(req: Request, res: Response): Promise<void> {
        try {
            const where: any = {};
            const { estado, id_cliente } = req.query;
            if (typeof estado === 'string' && estado) {
                where.estado = estado;
            }
            if (typeof id_cliente === 'string' && id_cliente) {
                where.id_cliente = Number(id_cliente);
            }
            const ventas = await Venta.findAll({
                where,
                include: includesVenta,
                order: [['fecha', 'DESC'], ['id', 'DESC']]
            });
            res.status(200).json(ventas.map(mapVenta));
        } catch (error) {
            handleError(res, error, 'Error al listar ventas');
        }
    }

    public static async obtener(req: Request, res: Response): Promise<void> {
        try {
            const venta = await Venta.findByPk(req.params.id, { include: includesVenta });
            if (!venta) {
                res.status(404).json({ mensaje: `No se encontró la venta con ID ${req.params.id}` });
                return;
            }
            res.status(200).json(mapVenta(venta));
        } catch (error) {
            handleError(res, error, 'Error al obtener la venta');
        }
    }

    public static async crear(req: Request, res: Response): Promise<void> {
        const usuario = getAuthUser(req);
        if (!usuario) {
            res.status(401).json({ mensaje: 'Usuario no autenticado' });
            return;
        }
        const datos = await DtoValidator.validateAndRespond(CrearVentaDTO, req.body, res);
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
            res.status(400).json({ mensaje: 'El total de la venta debe ser mayor a 0' });
            return;
        }
        if (pagoInicial > total) {
            res.status(400).json({ mensaje: 'El pago inicial no puede ser mayor al total' });
            return;
        }

        const transaction = await sequelize.transaction();
        try {
            const cliente = await Cliente.findByPk(datos.id_cliente, { transaction });
            if (!cliente || !cliente.get('activo')) {
                await transaction.rollback();
                res.status(400).json({ mensaje: 'El cliente no existe o está inactivo' });
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
            const venta = await Venta.create({
                id_cliente: datos.id_cliente,
                fecha: new Date(),
                total,
                saldo_pendiente: saldoPendiente,
                estado: estadoVentaPorSaldo(total, saldoPendiente),
                observacion: datos.observacion?.trim() || null,
                id_usuario: usuario.id
            }, { transaction });

            const idVenta = venta.get('id') as number;
            for (const linea of lineas) {
                if (linea.id_producto && !linea.descripcion) {
                    const producto = await Productos.findByPk(linea.id_producto, { transaction });
                    linea.descripcion = producto ? String(producto.get('nombre')) : 'Producto';
                }
                await VentaDetalle.create({ ...linea, id_venta: idVenta }, { transaction });
                if (linea.id_producto) {
                    const stock = await aplicarStock({
                        transaction,
                        idProducto: linea.id_producto,
                        delta: -linea.cantidad,
                        tipo: TIPO_INVENTARIO.SALIDA,
                        origen: 'VENTA',
                        origenId: idVenta,
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
                const cobranza = await Cobranza.create({
                    id_venta: idVenta,
                    id_cliente: datos.id_cliente,
                    id_caja: idCaja,
                    monto: pagoInicial,
                    metodo_pago: datos.metodo_pago,
                    referencia: datos.referencia || null,
                    observacion: 'Pago al registrar la venta',
                    fecha: new Date(),
                    id_usuario: usuario.id
                }, { transaction });

                const categoria = pagoInicial === total ? CATEGORIA_INGRESO.VENTA : CATEGORIA_INGRESO.COBRANZA;
                await registrarIngresoCaja({
                    transaction,
                    idCaja,
                    idUsuario: usuario.id,
                    categoria,
                    concepto: `Venta #${idVenta} - ${cliente.get('nombre')}`,
                    monto: pagoInicial,
                    metodoPago: datos.metodo_pago!,
                    referencia: datos.referencia || null,
                    origen: ORIGEN_MOVIMIENTO.VENTA,
                    origenId: cobranza.get('id') as number
                });
            }

            await transaction.commit();
            const creada = await Venta.findByPk(idVenta, { include: includesVenta });
            res.status(201).json({ mensaje: 'Venta registrada', data: mapVenta(creada) });
        } catch (error) {
            await transaction.rollback();
            handleError(res, error, 'Error al registrar la venta');
        }
    }
}

export class CobranzaController {
    public static async listar(req: Request, res: Response): Promise<void> {
        try {
            const where: any = {};
            if (typeof req.query.id_venta === 'string' && req.query.id_venta) {
                where.id_venta = Number(req.query.id_venta);
            }
            if (typeof req.query.id_cliente === 'string' && req.query.id_cliente) {
                where.id_cliente = Number(req.query.id_cliente);
            }
            const cobranzas = await Cobranza.findAll({
                where,
                include: [
                    { model: Cliente, as: 'cliente', attributes: ['id', 'nombre'] },
                    { model: Venta, as: 'venta', attributes: ['id', 'total', 'saldo_pendiente', 'estado'] },
                    { model: User, as: 'usuario', attributes: usuarioAtributos }
                ],
                order: [['fecha', 'DESC'], ['id', 'DESC']]
            });
            res.status(200).json(cobranzas.map(mapCobranza));
        } catch (error) {
            handleError(res, error, 'Error al listar cobranzas');
        }
    }

    public static async crear(req: Request, res: Response): Promise<void> {
        const usuario = getAuthUser(req);
        if (!usuario) {
            res.status(401).json({ mensaje: 'Usuario no autenticado' });
            return;
        }
        const datos = await DtoValidator.validateAndRespond(CrearCobranzaDTO, req.body, res);
        if (!datos) {
            return;
        }
        const monto = toMoney(datos.monto);

        const transaction = await sequelize.transaction();
        try {
            const venta = await Venta.findByPk(datos.id_venta, {
                include: [{ model: Cliente, as: 'cliente' }],
                transaction,
                lock: transaction.LOCK.UPDATE
            });
            if (!venta) {
                await transaction.rollback();
                res.status(404).json({ mensaje: `No se encontró la venta con ID ${datos.id_venta}` });
                return;
            }
            const estado = venta.get('estado') as string;
            if (estado === ESTADO_VENTA.ANULADA || estado === ESTADO_VENTA.PAGADA) {
                await transaction.rollback();
                res.status(409).json({ mensaje: 'Esta venta no admite cobranzas' });
                return;
            }
            const saldo = toMoney(venta.get('saldo_pendiente'));
            if (monto > saldo) {
                await transaction.rollback();
                res.status(400).json({ mensaje: `El monto supera el saldo pendiente (${saldo})` });
                return;
            }

            const cajaAbierta = await obtenerCajaAbierta(transaction);
            if (!cajaAbierta) {
                await transaction.rollback();
                res.status(409).json({ mensaje: 'Debe haber una caja abierta para registrar una cobranza' });
                return;
            }

            const saldoNuevo = roundMoney(saldo - monto);
            const total = toMoney(venta.get('total'));
            await venta.update({
                saldo_pendiente: saldoNuevo,
                estado: estadoVentaPorSaldo(total, saldoNuevo)
            }, { transaction });

            const idCaja = cajaAbierta.get('id') as number;
            const idCliente = venta.get('id_cliente') as number;
            const cobranza = await Cobranza.create({
                id_venta: datos.id_venta,
                id_cliente: idCliente,
                id_caja: idCaja,
                monto,
                metodo_pago: datos.metodo_pago,
                referencia: datos.referencia || null,
                observacion: datos.observacion || null,
                fecha: new Date(),
                id_usuario: usuario.id
            }, { transaction });

            const clienteNombre = (venta as any).cliente?.nombre || 'Cliente';
            await registrarIngresoCaja({
                transaction,
                idCaja,
                idUsuario: usuario.id,
                categoria: CATEGORIA_INGRESO.COBRANZA,
                concepto: `Cobranza venta #${datos.id_venta} - ${clienteNombre}`,
                monto,
                metodoPago: datos.metodo_pago,
                referencia: datos.referencia || null,
                observacion: datos.observacion || null,
                origen: ORIGEN_MOVIMIENTO.COBRANZA,
                origenId: cobranza.get('id') as number
            });

            await transaction.commit();
            const creada = await Cobranza.findByPk(cobranza.get('id') as number, {
                include: [
                    { model: Cliente, as: 'cliente', attributes: ['id', 'nombre'] },
                    { model: Venta, as: 'venta', attributes: ['id', 'total', 'saldo_pendiente', 'estado'] },
                    { model: User, as: 'usuario', attributes: usuarioAtributos }
                ]
            });
            res.status(201).json({ mensaje: 'Cobranza registrada', data: mapCobranza(creada) });
        } catch (error) {
            await transaction.rollback();
            handleError(res, error, 'Error al registrar la cobranza');
        }
    }
}
