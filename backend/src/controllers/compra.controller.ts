import { Request, Response } from 'express';
import { Compra, CompraDetalle, Empresa, PagoProveedor, Productos, Proveedor, sequelize, User } from '../models';
import { handleError } from '../utils/error.handler';
import { DtoValidator } from '../utils/dto.validador';
import { getAuthUser } from '../utils/auth-user';
import { roundMoney, toMoney } from '../utils/money';
import { obtenerCajaAbierta, registrarEgresosPartidos } from '../utils/caja-ingreso';
import { aplicarStock, TIPO_INVENTARIO } from '../utils/inventario';
import { CATEGORIA_EGRESO, ORIGEN_MOVIMIENTO } from '../constants/caja.constants';
import { ESTADO_COMPRA, estadoCompraPorSaldo, inferirTipoCompra, TIPO_CAMBIO_DEFAULT, TIPO_COMPRA } from '../constants/compra.constants';
import { CrearCompraDTO, CrearPagoProveedorDTO } from '../dtos/compra.dto';
import { camposPagoDocumento } from '../utils/metodo-pago';
import { esCompraServicio } from '../utils/cuenta-proveedor';
import { parseFechaLocal, ymdLocal } from '../utils/fecha';
import { datosEmpresa, normalizarTipoCambio, refrescarEmpresa } from '../utils/empresa';
import { MENSAJE_UNIDAD_MEDIDA, unidadMedidaInvalida } from '../utils/unidad-medida';
import { resolverPlazoCredito } from '../utils/credito';

const usuarioAtributos = ['id', 'username'];

function fechaCompra(valor?: string): Date {
    if (!valor) {
        return new Date();
    }
    const fecha = parseFechaLocal(valor);
    if (Number.isNaN(fecha.getTime())) {
        return new Date();
    }
    if (ymdLocal(fecha) === ymdLocal()) {
        return new Date();
    }
    fecha.setHours(12, 0, 0, 0);
    return fecha;
}

function mapLinea(detalle: any) {
    return {
        id: detalle.id,
        descripcion: detalle.descripcion,
        id_producto: detalle.id_producto,
        unidad: detalle.unidad || null,
        cantidad: Number(detalle.cantidad),
        precio_unitario: toMoney(detalle.precio_unitario),
        subtotal: toMoney(detalle.subtotal)
    };
}

function usdReferencial(montoBs: number, tipoCambio: unknown): number | null {
    const tc = Number(tipoCambio);
    if (!Number.isFinite(tc) || tc <= 0) {
        return null;
    }
    return roundMoney(toMoney(montoBs) / tc);
}

function mapPago(item: any) {
    return {
        id: item.id,
        id_compra: item.id_compra,
        id_proveedor: item.id_proveedor,
        id_caja: item.id_caja,
        monto: toMoney(item.monto),
        metodo_pago: item.metodo_pago,
        monto_efectivo: toMoney(item.monto_efectivo),
        monto_qr: toMoney(item.monto_qr),
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
                estado: item.compra.estado,
                tipo_compra: inferirTipoCompra(item.compra),
                tipo_cambio: item.compra.tipo_cambio != null ? Number(item.compra.tipo_cambio) : null,
                total_usd: item.compra.total_usd != null ? toMoney(item.compra.total_usd) : null
            }
            : null,
        monto_usd: item.compra ? usdReferencial(item.monto, item.compra.tipo_cambio) : null,
        usuario: item.usuario ? { id: item.usuario.id, username: item.usuario.username } : null
    };
}

function mapCompra(compra: any) {
    const total = toMoney(compra.total);
    const saldo = toMoney(compra.saldo_pendiente);
    const tipoCompra = inferirTipoCompra(compra);
    const tipoCambio = compra.tipo_cambio != null ? Number(compra.tipo_cambio) : null;
    return {
        id: compra.id,
        id_proveedor: compra.id_proveedor,
        fecha: compra.fecha,
        total,
        saldo_pendiente: saldo,
        pagado: roundMoney(total - saldo),
        estado: compra.estado,
        observacion: compra.observacion,
        concepto: compra.concepto || null,
        boleta: compra.boleta || null,
        chofer: compra.chofer || null,
        placa: compra.placa || null,
        fanegas: compra.fanegas != null ? Number(compra.fanegas) : null,
        tipo_compra: tipoCompra,
        tipo_cambio: tipoCambio,
        total_usd: compra.total_usd != null ? toMoney(compra.total_usd) : null,
        precio_usd: compra.precio_usd != null ? Number(compra.precio_usd) : null,
        es_servicio: esCompraServicio(compra),
        id_productor: compra.id_productor || null,
        plazo_dias: compra.plazo_dias != null ? Number(compra.plazo_dias) : null,
        fecha_vencimiento: compra.fecha_vencimiento || null,
        productor: compra.productor ? { id: compra.productor.id, nombre: compra.productor.nombre } : null,
        proveedor: compra.proveedor ? { id: compra.proveedor.id, nombre: compra.proveedor.nombre } : null,
        usuario: compra.usuario ? { id: compra.usuario.id, username: compra.usuario.username } : null,
        detalles: (compra.detalles || []).map(mapLinea),
        pagos: (compra.pagos || []).map(mapPago)
    };
}

const includesCompra = [
    { model: Proveedor, as: 'proveedor', attributes: ['id', 'nombre'] },
    { model: Proveedor, as: 'productor', attributes: ['id', 'nombre'] },
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

        const tipoCompra = inferirTipoCompra({
            tipo_compra: datos.tipo_compra,
            fanegas: datos.fanegas,
            boleta: datos.boleta
        });
        const esChala = tipoCompra === TIPO_COMPRA.CHALA;
        const pagoInicial = toMoney(datos.pago_inicial || 0);
        const tipoCambio = esChala
            ? normalizarTipoCambio(datos.tipo_cambio, datosEmpresa().tipo_cambio || TIPO_CAMBIO_DEFAULT)
            : null;
        if (esChala && (!tipoCambio || tipoCambio <= 0)) {
            res.status(400).json({ mensaje: 'El tipo de cambio debe ser mayor a 0' });
            return;
        }

        const precioUsd = esChala ? toMoney(datos.precio_usd || datos.lineas[0]?.precio_unitario || 0) : null;
        const fanegas = esChala ? Number(datos.fanegas || datos.lineas[0]?.cantidad || 0) : null;
        const totalUsd = esChala ? roundMoney(Number(fanegas) * Number(precioUsd)) : null;

        const origenLineas = esChala ? datos.lineas.slice(0, 1) : datos.lineas;
        if (tipoCompra === TIPO_COMPRA.BOLSAS && origenLineas.some((linea) => !linea.id_producto)) {
            res.status(400).json({ mensaje: 'En bolsas y empaques cada línea debe tener un producto de inventario' });
            return;
        }
        const lineas = origenLineas.map((linea) => {
            const cantidad = esChala ? Number(fanegas) : Number(linea.cantidad);
            const precioIngresado = toMoney(linea.precio_unitario);
            const precio = esChala ? roundMoney(Number(precioUsd) * Number(tipoCambio)) : precioIngresado;
            const subtotal = esChala ? roundMoney(Number(totalUsd) * Number(tipoCambio)) : roundMoney(cantidad * precio);
            return {
                descripcion: (linea.descripcion || '').trim(),
                cantidad,
                precio_unitario: precio,
                subtotal,
                id_producto: linea.id_producto || null,
                unidad: (linea.unidad || (esChala ? 'fanega' : '')).trim() || null
            };
        });
        const total = esChala
            ? roundMoney(Number(totalUsd) * Number(tipoCambio))
            : roundMoney(lineas.reduce((acc, linea) => acc + linea.subtotal, 0));
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

            let idProductor: number | null = null;
            if (esChala) {
                const id = Number(datos.id_productor);
                if (!id) {
                    await transaction.rollback();
                    res.status(400).json({ mensaje: 'Seleccione el productor del arroz' });
                    return;
                }
                const productor = await Proveedor.findByPk(id, { transaction });
                if (!productor || !productor.get('activo')) {
                    await transaction.rollback();
                    res.status(400).json({ mensaje: 'El productor no existe o está inactivo' });
                    return;
                }
                idProductor = id;
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
            const compra = await Compra.create({
                id_proveedor: datos.id_proveedor,
                id_productor: idProductor,
                fecha: fechaCompra(datos.fecha),
                total,
                saldo_pendiente: saldoPendiente,
                estado: estadoCompraPorSaldo(total, saldoPendiente),
                observacion: datos.observacion?.trim() || null,
                plazo_dias: plazo.plazo_dias,
                fecha_vencimiento: plazo.fecha_vencimiento,
                concepto: datos.concepto?.trim() || null,
                boleta: esChala ? (datos.boleta?.trim() || null) : null,
                chofer: esChala ? (datos.chofer?.trim() || null) : null,
                placa: esChala ? (datos.placa?.trim() || null) : null,
                fanegas: esChala && fanegas && fanegas > 0 ? fanegas : null,
                tipo_compra: tipoCompra,
                tipo_cambio: tipoCambio,
                total_usd: totalUsd,
                precio_usd: precioUsd,
                id_usuario: usuario.id
            }, { transaction });

            if (esChala && datos.guardar_tipo_cambio_empresa && tipoCambio) {
                const empresa = await Empresa.findOne({ order: [['id', 'ASC']], transaction });
                if (empresa) {
                    await empresa.update({ tipo_cambio: tipoCambio }, { transaction });
                }
            }

            const idCompra = compra.get('id') as number;
            for (const linea of lineas) {
                if (linea.id_producto && (!linea.descripcion || !linea.unidad)) {
                    const producto = await Productos.findByPk(linea.id_producto, { transaction });
                    if (producto) {
                        if (!linea.descripcion) {
                            linea.descripcion = String(producto.get('nombre'));
                        }
                        if (!linea.unidad) {
                            linea.unidad = String(producto.get('unidad_medida') || '') || null;
                        }
                    }
                }
                if (linea.unidad && unidadMedidaInvalida(linea.unidad)) {
                    await transaction.rollback();
                    res.status(400).json({ mensaje: MENSAJE_UNIDAD_MEDIDA });
                    return;
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
                const pagoDoc = camposPagoDocumento(datos, pagoInicial);
                if (!pagoDoc.ok) {
                    await transaction.rollback();
                    res.status(400).json({ mensaje: pagoDoc.mensaje });
                    return;
                }
                const idCaja = cajaAbierta.get('id') as number;
                const pago = await PagoProveedor.create({
                    id_compra: idCompra,
                    id_proveedor: datos.id_proveedor,
                    id_caja: idCaja,
                    monto: pagoDoc.monto,
                    metodo_pago: pagoDoc.metodo_pago,
                    monto_efectivo: pagoDoc.monto_efectivo,
                    monto_qr: pagoDoc.monto_qr,
                    referencia: datos.referencia || null,
                    observacion: 'Pago al registrar la compra',
                    fecha: new Date(),
                    id_usuario: usuario.id
                }, { transaction });

                const egreso = await registrarEgresosPartidos({
                    transaction,
                    idCaja,
                    idUsuario: usuario.id,
                    categoria: CATEGORIA_EGRESO.PAGO_PROVEEDOR,
                    concepto: `Compra #${idCompra} - ${proveedor.get('nombre')}`,
                    monto: pagoInicial,
                    metodoPago: datos.metodo_pago!,
                    montoEfectivo: datos.monto_efectivo,
                    montoQr: datos.monto_qr,
                    referencia: datos.referencia || null,
                    origen: ORIGEN_MOVIMIENTO.COMPRA,
                    origenId: pago.get('id') as number
                });
                if (!egreso.ok) {
                    await transaction.rollback();
                    res.status(400).json({ mensaje: egreso.mensaje });
                    return;
                }
            }

            await transaction.commit();
            if (esChala && datos.guardar_tipo_cambio_empresa) {
                await refrescarEmpresa();
            }
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
                    { model: Compra, as: 'compra', attributes: ['id', 'total', 'saldo_pendiente', 'estado', 'tipo_compra', 'tipo_cambio', 'total_usd', 'fanegas', 'boleta'] },
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
            const pagoDoc = camposPagoDocumento(datos, monto);
            if (!pagoDoc.ok) {
                await transaction.rollback();
                res.status(400).json({ mensaje: pagoDoc.mensaje });
                return;
            }
            const pago = await PagoProveedor.create({
                id_compra: datos.id_compra,
                id_proveedor: idProveedor,
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

            const nombreProveedor = (compra as any).proveedor?.nombre || 'Proveedor';
            const egreso = await registrarEgresosPartidos({
                transaction,
                idCaja,
                idUsuario: usuario.id,
                categoria: CATEGORIA_EGRESO.PAGO_PROVEEDOR,
                concepto: `Pago compra #${datos.id_compra} - ${nombreProveedor}`,
                monto,
                metodoPago: datos.metodo_pago,
                montoEfectivo: datos.monto_efectivo,
                montoQr: datos.monto_qr,
                referencia: datos.referencia || null,
                observacion: datos.observacion || null,
                origen: ORIGEN_MOVIMIENTO.PAGO_PROVEEDOR,
                origenId: pago.get('id') as number
            });
            if (!egreso.ok) {
                await transaction.rollback();
                res.status(400).json({ mensaje: egreso.mensaje });
                return;
            }

            await transaction.commit();
            const creado = await PagoProveedor.findByPk(pago.get('id') as number, {
                include: [
                    { model: Proveedor, as: 'proveedor', attributes: ['id', 'nombre'] },
                    { model: Compra, as: 'compra', attributes: ['id', 'total', 'saldo_pendiente', 'estado', 'tipo_compra', 'tipo_cambio', 'total_usd', 'fanegas', 'boleta'] },
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
