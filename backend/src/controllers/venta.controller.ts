import { Request, Response } from 'express';
import { createHash } from 'crypto';
import { CategoriaProducto, Cliente, Cobranza, Productos, sequelize, User, Venta, VentaDetalle } from '../models';
import { Op, UniqueConstraintError } from 'sequelize';
import { handleError } from '../utils/error.handler';
import { aplicarFiltroFecha, parseFechaLocal, ymdLocal } from '../utils/fecha';
import { resolverPlazoCredito } from '../utils/credito';
import { DtoValidator } from '../utils/dto.validador';
import { getAuthUser, mapUsuarioResumen } from '../utils/auth-user';
import { roundMoney, toMoney } from '../utils/money';
import { obtenerCajaAbierta, registrarEgresoCaja, registrarIngresosPartidos } from '../utils/caja-ingreso';
import { aplicarStock, TIPO_INVENTARIO } from '../utils/inventario';
import { CATEGORIA_EGRESO, CATEGORIA_INGRESO, ORIGEN_MOVIMIENTO } from '../constants/caja.constants';
import { cobradoVenta, diasAtraso, diasParaVencer, ESTADO_VENTA, estadoVentaPorSaldo, esVentaVencida, situacionCobranza } from '../constants/venta.constants';
import { CrearCobranzaDTO, CrearVentaDTO } from '../dtos/venta.dto';
import { camposPagoDocumento, conceptoPorCanal, partesDesdeDocumento } from '../utils/metodo-pago';
import { esProductoEmpaque } from '../utils/empaque';
import { VentaEntrega, ReservaVenta } from '../models/despacho.model';
import { cantidadEntrega, despachosHabilitados, ErrorDespacho, liberarReservas, registrarDespacho, reservarLinea } from '../servicios/despachos.servicio';

const usuarioAtributos = ['id', 'username', 'nombre'];

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

export function mapVenta(venta: any) {
    const total = toMoney(venta.total);
    const saldo = toMoney(venta.saldo_pendiente);
    return {
        id: venta.id,
        id_cliente: venta.id_cliente,
        fecha: venta.fecha,
        total,
        saldo_pendiente: saldo,
        pagado: cobradoVenta(total, saldo, venta.estado),
        estado: venta.estado,
        estado_despacho: venta.entrega?.estado || 'ANTERIOR',
        observacion: venta.observacion,
        plazo_dias: venta.plazo_dias != null ? Number(venta.plazo_dias) : null,
        fecha_vencimiento: venta.fecha_vencimiento || null,
        vencida: esVentaVencida(venta.fecha_vencimiento, saldo, venta.estado),
        dias_vencimiento: diasParaVencer(venta.fecha_vencimiento),
        dias_atraso: diasAtraso(venta.fecha_vencimiento, saldo, venta.estado),
        situacion: situacionCobranza(venta.fecha_vencimiento, saldo, venta.estado),
        cliente: venta.cliente ? { id: venta.cliente.id, nombre: venta.cliente.nombre } : null,
        usuario: mapUsuarioResumen(venta.usuario),
        detalles: (venta.detalles || []).map((d: any) => {
            const r = (venta.reservas || []).find((r: any) => r.id_detalle === d.id);
            return { ...mapLinea(d), unidad: r?.unidad || null, entregado: r ? Number(r.entregado) : null, pendiente: r ? Number(r.pendiente) : null };
        }),
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
        monto_efectivo: toMoney(item.monto_efectivo),
        monto_qr: toMoney(item.monto_qr),
        referencia: item.referencia,
        observacion: item.observacion,
        fecha: item.fecha,
        cliente: item.cliente ? { id: item.cliente.id, nombre: item.cliente.nombre } : null,
        venta: item.venta ? { id: item.venta.id, total: toMoney(item.venta.total), saldo_pendiente: toMoney(item.venta.saldo_pendiente), estado: item.venta.estado } : null,
        usuario: mapUsuarioResumen(item.usuario)
    };
}

export const includesVenta = [
    { model: VentaEntrega, as: 'entrega' },
    { model: ReservaVenta, as: 'reservas' },
    { model: Cliente, as: 'cliente', attributes: ['id', 'nombre'] },
    { model: User, as: 'usuario', attributes: usuarioAtributos },
    { model: VentaDetalle, as: 'detalles' },
    { model: Cobranza, as: 'cobranzas', include: [{ model: User, as: 'usuario', attributes: usuarioAtributos }] }
];

export class VentaController {
    public static async listar(req: Request, res: Response): Promise<void> {
        try {
            const where: any = {};
            const { estado, id_cliente, fecha_desde, fecha_hasta } = req.query;
            if (estado === 'VENCIDA') {
                where.estado = { [Op.in]: [ESTADO_VENTA.PENDIENTE, ESTADO_VENTA.PARCIAL] };
                where.saldo_pendiente = { [Op.gt]: 0 };
                where.fecha_vencimiento = { [Op.lt]: ymdLocal() };
            } else if (typeof estado === 'string' && estado) {
                where.estado = estado;
            } else {
                where.estado = { [Op.ne]: ESTADO_VENTA.ANULADA };
            }
            if (typeof id_cliente === 'string' && id_cliente) {
                where.id_cliente = Number(id_cliente);
            }
            if (typeof fecha_desde === 'string' && fecha_desde) {
                const inicio = parseFechaLocal(fecha_desde);
                if (!Number.isNaN(inicio.getTime())) {
                    inicio.setHours(0, 0, 0, 0);
                    where.fecha = { ...(where.fecha || {}), [Op.gte]: inicio };
                }
            }
            if (typeof fecha_hasta === 'string' && fecha_hasta) {
                const fin = parseFechaLocal(fecha_hasta);
                if (!Number.isNaN(fin.getTime())) {
                    fin.setHours(23, 59, 59, 999);
                    where.fecha = { ...(where.fecha || {}), [Op.lte]: fin };
                }
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

        const nuevoFlujo = despachosHabilitados();
        const solicitud = createHash('sha256').update(JSON.stringify(datos)).digest('hex');
        if (datos.entrega && !nuevoFlujo) {
            res.status(409).json({ mensaje: 'El nuevo flujo de despachos aun no esta habilitado' }); return;
        }
        if (nuevoFlujo && (!datos.entrega || !datos.clave)) {
            res.status(400).json({ mensaje: 'Indique modalidad de entrega y clave de solicitud' }); return;
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
            if (nuevoFlujo) {
                const anterior = await VentaEntrega.findOne({ where: { clave: datos.clave }, transaction });
                if (anterior) {
                    const v = await Venta.findByPk(Number(anterior.get('id_venta')), { transaction, include: includesVenta });
                    if (Number(v?.get('id_usuario')) !== usuario.id || anterior.get('solicitud') !== solicitud) throw new ErrorDespacho('Clave de solicitud ya utilizada con otros datos');
                    await transaction.commit(); res.status(200).json({ mensaje: 'Venta ya registrada', data: mapVenta(v) }); return;
                }
            }
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
            const plazo = resolverPlazoCredito(saldoPendiente, datos.plazo_dias, datos.fecha_vencimiento);
            if (!plazo.ok) {
                await transaction.rollback();
                res.status(400).json({ mensaje: plazo.mensaje });
                return;
            }
            const venta = await Venta.create({
                id_cliente: datos.id_cliente,
                fecha: new Date(),
                total,
                saldo_pendiente: saldoPendiente,
                estado: estadoVentaPorSaldo(total, saldoPendiente),
                observacion: datos.observacion?.trim() || null,
                plazo_dias: plazo.plazo_dias,
                fecha_vencimiento: plazo.fecha_vencimiento,
                id_usuario: usuario.id
            }, { transaction });

            const idVenta = venta.get('id') as number;
            if (nuevoFlujo) await VentaEntrega.create({ id_venta: idVenta, clave: datos.clave, solicitud, estado: lineas.some(l => l.id_producto) ? 'PENDIENTE' : 'NO_APLICA' }, { transaction });
            const inicial: { id_detalle: number; cantidad: number }[] = [];
            // Bloquear antes de insertar detalles evita actualizar bloqueos compartidos de sus FK.
            for (const id of [...new Set(lineas.map(l => l.id_producto).filter((id): id is number => !!id))].sort((a, b) => a - b)) {
                const producto = await Productos.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
                if (!producto || producto.get('eliminado')) throw new ErrorDespacho('Producto inexistente o inactivo', 400);
            }
            // Mantener el mismo orden de bloqueo en ventas concurrentes.
            for (const linea of [...lineas].sort((a, b) => (a.id_producto || 0) - (b.id_producto || 0))) {
                if (linea.id_producto) {
                    const producto = await Productos.findByPk(linea.id_producto, {
                        transaction,
                        include: [{ model: CategoriaProducto, as: 'categoria', attributes: ['id', 'nombre'] }]
                    });
                    if (!linea.descripcion) {
                        linea.descripcion = producto ? String(producto.get('nombre')) : 'Producto';
                    }
                    if (esProductoEmpaque({
                        nombre: producto?.get('nombre'),
                        categoria: (producto as any)?.categoria
                    })) {
                        await transaction.rollback();
                        res.status(400).json({ mensaje: 'Las bolsas y empaques no se venden. Registre la salida en Bolsas y empaques.' });
                        return;
                    }
                }
                const detalle = await VentaDetalle.create({ ...linea, id_venta: idVenta }, { transaction });
                if (linea.id_producto && nuevoFlujo) {
                    await reservarLinea(detalle, transaction);
                    const original = datos.lineas[lineas.indexOf(linea)];
                    const cantidad = datos.entrega === 'COMPLETA' ? linea.cantidad : datos.entrega === 'POSTERIOR' ? 0 : cantidadEntrega(original.entregar_ahora ?? 0, linea.cantidad);
                    inicial.push({ id_detalle: Number(detalle.get('id')), cantidad });
                }
                if (linea.id_producto && !nuevoFlujo) {
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

            if (nuevoFlujo && inicial.some(l => l.cantidad > 0)) {
                await registrarDespacho(idVenta, { clave: `${datos.clave}_inicial`, persona_retira: datos.persona_retira || '', lineas: inicial }, usuario.id, transaction);
            } else if (nuevoFlujo && datos.entrega === 'PARCIAL' && inicial.length) {
                throw new ErrorDespacho('La entrega parcial requiere al menos una cantidad positiva', 400);
            }
            if (pagoInicial > 0 && cajaAbierta) {
                const pagoDoc = camposPagoDocumento(datos, pagoInicial);
                if (!pagoDoc.ok) {
                    await transaction.rollback();
                    res.status(400).json({ mensaje: pagoDoc.mensaje });
                    return;
                }
                const idCaja = cajaAbierta.get('id') as number;
                const cobranza = await Cobranza.create({
                    id_venta: idVenta,
                    id_cliente: datos.id_cliente,
                    id_caja: idCaja,
                    monto: pagoDoc.monto,
                    metodo_pago: pagoDoc.metodo_pago,
                    monto_efectivo: pagoDoc.monto_efectivo,
                    monto_qr: pagoDoc.monto_qr,
                    referencia: datos.referencia || null,
                    observacion: 'Pago al registrar la venta',
                    fecha: new Date(),
                    id_usuario: usuario.id
                }, { transaction });

                const categoria = pagoInicial === total ? CATEGORIA_INGRESO.VENTA : CATEGORIA_INGRESO.COBRANZA;
                const ingreso = await registrarIngresosPartidos({
                    transaction,
                    idCaja,
                    idUsuario: usuario.id,
                    categoria,
                    concepto: `Venta #${idVenta} - ${cliente.get('nombre')}`,
                    monto: pagoInicial,
                    metodoPago: datos.metodo_pago!,
                    montoEfectivo: datos.monto_efectivo,
                    montoQr: datos.monto_qr,
                    referencia: datos.referencia || null,
                    origen: ORIGEN_MOVIMIENTO.VENTA,
                    origenId: cobranza.get('id') as number
                });
                if (!ingreso.ok) {
                    await transaction.rollback();
                    res.status(400).json({ mensaje: ingreso.mensaje });
                    return;
                }
            }

            await transaction.commit();
            const creada = await Venta.findByPk(idVenta, { include: includesVenta });
            res.status(201).json({ mensaje: 'Venta registrada', data: mapVenta(creada) });
        } catch (error) {
            await transaction.rollback();
            if (nuevoFlujo && error instanceof UniqueConstraintError) {
                const anterior = await VentaEntrega.findOne({ where: { clave: datos.clave } });
                const v = anterior ? await Venta.findByPk(Number(anterior.get('id_venta')), { include: includesVenta }) : null;
                if (v && Number(v.get('id_usuario')) === usuario.id && anterior?.get('solicitud') === solicitud) {
                    res.status(200).json({ mensaje: 'Venta ya registrada', data: mapVenta(v) }); return;
                }
                res.status(409).json({ mensaje: 'Clave de solicitud ya utilizada con otros datos' }); return;
            }
            if (error instanceof ErrorDespacho) { res.status(error.status).json({ mensaje: error.message }); return; }
            handleError(res, error, 'Error al registrar la venta');
        }
    }

    public static async anular(req: Request, res: Response): Promise<void> {
        const usuario = getAuthUser(req);
        if (!usuario) {
            res.status(401).json({ mensaje: 'Usuario no autenticado' });
            return;
        }
        const transaction = await sequelize.transaction();
        try {
            const venta = await Venta.findByPk(req.params.id, {
                transaction,
                lock: transaction.LOCK.UPDATE
            });
            if (!venta) {
                await transaction.rollback();
                res.status(404).json({ mensaje: `No se encontró la venta con ID ${req.params.id}` });
                return;
            }
            if (venta.get('estado') === ESTADO_VENTA.ANULADA) {
                await transaction.rollback();
                res.status(409).json({ mensaje: 'Esta venta ya está anulada' });
                return;
            }

            const idVenta = venta.get('id') as number;
            const [cliente, detalles, cobranzas] = await Promise.all([
                Cliente.findByPk(venta.get('id_cliente') as number, { transaction }),
                VentaDetalle.findAll({ where: { id_venta: idVenta }, transaction }),
                Cobranza.findAll({ where: { id_venta: idVenta }, transaction })
            ]);
            const total = toMoney(venta.get('total'));
            const saldo = toMoney(venta.get('saldo_pendiente'));
            const cobrado = roundMoney(total - saldo);
            const clienteNombre = cliente?.get('nombre') || 'Cliente';
            const entrega = await VentaEntrega.findByPk(idVenta, { transaction, lock: transaction.LOCK.UPDATE });
            if (entrega) await liberarReservas(idVenta, transaction);
            else if (despachosHabilitados() && detalles.some(l => l.get('id_producto'))) {
                throw new ErrorDespacho('Venta anterior: resuelva su entrega y devolucion por separado antes de anular');
            }

            if (cobrado > 0) {
                const cajaAbierta = await obtenerCajaAbierta(transaction);
                if (!cajaAbierta) {
                    await transaction.rollback();
                    res.status(409).json({ mensaje: 'Debe haber una caja abierta para devolver lo cobrado' });
                    return;
                }
                const idCaja = cajaAbierta.get('id') as number;
                if (cobranzas.length) {
                    for (const cob of cobranzas) {
                        const partes = partesDesdeDocumento({
                            metodo_pago: cob.get('metodo_pago') as string,
                            monto: cob.get('monto'),
                            monto_efectivo: cob.get('monto_efectivo'),
                            monto_qr: cob.get('monto_qr')
                        });
                        for (const parte of partes) {
                            await registrarEgresoCaja({
                                transaction,
                                idCaja,
                                idUsuario: usuario.id,
                                categoria: CATEGORIA_EGRESO.ANULACION_VENTA,
                                concepto: conceptoPorCanal(`Anulación venta #${idVenta} - ${clienteNombre}`, parte, partes.length),
                                monto: parte.monto,
                                metodoPago: parte.metodo,
                                origen: ORIGEN_MOVIMIENTO.VENTA,
                                origenId: idVenta
                            });
                        }
                    }
                } else {
                    await registrarEgresoCaja({
                        transaction,
                        idCaja,
                        idUsuario: usuario.id,
                        categoria: CATEGORIA_EGRESO.ANULACION_VENTA,
                        concepto: `Anulación venta #${idVenta} - ${clienteNombre}`,
                        monto: cobrado,
                        metodoPago: 'EFECTIVO',
                        origen: ORIGEN_MOVIMIENTO.VENTA,
                        origenId: idVenta
                    });
                }
            }

            for (const linea of detalles) {
                if (entrega) continue;
                const idProducto = linea.get('id_producto') as number | null;
                if (!idProducto) {
                    continue;
                }
                const stock = await aplicarStock({
                    transaction,
                    idProducto,
                    delta: Number(linea.get('cantidad')),
                    tipo: TIPO_INVENTARIO.ENTRADA,
                    origen: 'VENTA',
                    origenId: idVenta,
                    idUsuario: usuario.id,
                    observacion: `Anulación venta #${idVenta}`
                });
                if (!stock.ok) {
                    await transaction.rollback();
                    res.status(409).json({ mensaje: stock.mensaje });
                    return;
                }
            }

            await venta.update({
                estado: ESTADO_VENTA.ANULADA,
                saldo_pendiente: 0,
                observacion: [venta.get('observacion'), 'Anulada'].filter(Boolean).join(' · ')
            }, { transaction });

            await transaction.commit();
            const anulada = await Venta.findByPk(idVenta, { include: includesVenta });
            res.status(200).json({ mensaje: 'Venta anulada', data: mapVenta(anulada) });
        } catch (error) {
            await transaction.rollback();
            if (error instanceof ErrorDespacho) { res.status(error.status).json({ mensaje: error.message }); return; }
            handleError(res, error, 'Error al anular la venta');
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
            if (typeof req.query.metodo === 'string' && req.query.metodo) {
                where.metodo_pago = req.query.metodo;
            }
            aplicarFiltroFecha(where, req.query);
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
            const pagoDoc = camposPagoDocumento(datos, monto);
            if (!pagoDoc.ok) {
                await transaction.rollback();
                res.status(400).json({ mensaje: pagoDoc.mensaje });
                return;
            }
            const cobranza = await Cobranza.create({
                id_venta: datos.id_venta,
                id_cliente: idCliente,
                id_caja: idCaja,
                monto: pagoDoc.monto,
                metodo_pago: pagoDoc.metodo_pago,
                monto_efectivo: pagoDoc.monto_efectivo,
                monto_qr: pagoDoc.monto_qr,
                referencia: datos.referencia || null,
                observacion: datos.observacion || null,
                fecha: new Date(),
                id_usuario: usuario.id
            }, { transaction });

            const clienteNombre = (venta as any).cliente?.nombre || 'Cliente';
            const ingreso = await registrarIngresosPartidos({
                transaction,
                idCaja,
                idUsuario: usuario.id,
                categoria: CATEGORIA_INGRESO.COBRANZA,
                concepto: `Cobranza venta #${datos.id_venta} - ${clienteNombre}`,
                monto,
                metodoPago: datos.metodo_pago,
                montoEfectivo: datos.monto_efectivo,
                montoQr: datos.monto_qr,
                referencia: datos.referencia || null,
                observacion: datos.observacion || null,
                origen: ORIGEN_MOVIMIENTO.COBRANZA,
                origenId: cobranza.get('id') as number
            });
            if (!ingreso.ok) {
                await transaction.rollback();
                res.status(400).json({ mensaje: ingreso.mensaje });
                return;
            }

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
