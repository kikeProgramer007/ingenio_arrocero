import { Request, Response } from 'express';
import { Acopio, Campana, Productos, Proveedor, sequelize, User } from '../models';
import { ESTADO_CAMPANA } from '../models/campana.model';
import { handleError } from '../utils/error.handler';
import { DtoValidator } from '../utils/dto.validador';
import { getAuthUser } from '../utils/auth-user';
import { roundMoney, toMoney } from '../utils/money';
import { obtenerCajaAbierta, registrarEgresoCaja } from '../utils/caja-ingreso';
import { aplicarStock, TIPO_INVENTARIO, toQty } from '../utils/inventario';
import { CATEGORIA_EGRESO, ORIGEN_MOVIMIENTO } from '../constants/caja.constants';
import { CrearAcopioDTO, CrearCampanaDTO } from '../dtos/campana.dto';

function mapAcopio(item: any) {
    return {
        id: item.id,
        id_campana: item.id_campana,
        descripcion: item.descripcion,
        cantidad: toQty(item.cantidad),
        precio_unitario: toMoney(item.precio_unitario),
        total: toMoney(item.total),
        pago: toMoney(item.pago),
        metodo_pago: item.metodo_pago,
        fecha: item.fecha,
        observacion: item.observacion,
        proveedor: item.proveedor ? { id: item.proveedor.id, nombre: item.proveedor.nombre } : null,
        producto: item.producto ? { id: item.producto.id, nombre: item.producto.nombre } : null,
        usuario: item.usuario ? { id: item.usuario.id, username: item.usuario.username } : null
    };
}

function mapCampana(item: any) {
    const acopios = (item.acopios || []).map(mapAcopio);
    const totalCantidad = acopios.reduce((acc: number, a: any) => acc + a.cantidad, 0);
    const totalMonto = acopios.reduce((acc: number, a: any) => acc + a.total, 0);
    return {
        id: item.id,
        nombre: item.nombre,
        fecha_inicio: item.fecha_inicio,
        fecha_fin: item.fecha_fin,
        meta_cantidad: item.meta_cantidad != null ? toQty(item.meta_cantidad) : null,
        estado: item.estado,
        observacion: item.observacion,
        total_cantidad: Math.round(totalCantidad * 1000) / 1000,
        total_monto: roundMoney(totalMonto),
        usuario: item.usuario ? { id: item.usuario.id, username: item.usuario.username } : null,
        acopios
    };
}

export class CampanaController {
    public static async listar(_req: Request, res: Response): Promise<void> {
        try {
            const campanas = await Campana.findAll({
                include: [
                    { model: User, as: 'usuario', attributes: ['id', 'username'] },
                    {
                        model: Acopio,
                        as: 'acopios',
                        include: [
                            { model: Proveedor, as: 'proveedor', attributes: ['id', 'nombre'] },
                            { model: Productos, as: 'producto', attributes: ['id', 'nombre'] }
                        ]
                    }
                ],
                order: [['fecha_inicio', 'DESC'], ['id', 'DESC']]
            });
            res.status(200).json(campanas.map(mapCampana));
        } catch (error) {
            handleError(res, error, 'Error al listar campañas');
        }
    }

    public static async crear(req: Request, res: Response): Promise<void> {
        const usuario = getAuthUser(req);
        if (!usuario) {
            res.status(401).json({ mensaje: 'Usuario no autenticado' });
            return;
        }
        const datos = await DtoValidator.validateAndRespond(CrearCampanaDTO, req.body, res);
        if (!datos) {
            return;
        }
        try {
            const campana = await Campana.create({
                nombre: datos.nombre.trim(),
                fecha_inicio: datos.fecha_inicio,
                fecha_fin: datos.fecha_fin || null,
                meta_cantidad: datos.meta_cantidad ?? null,
                estado: ESTADO_CAMPANA.ABIERTA,
                observacion: datos.observacion || null,
                id_usuario: usuario.id
            });
            res.status(201).json({ mensaje: 'Campaña creada', data: mapCampana(campana) });
        } catch (error) {
            handleError(res, error, 'Error al crear la campaña');
        }
    }

    public static async cerrar(req: Request, res: Response): Promise<void> {
        try {
            const campana = await Campana.findByPk(req.params.id);
            if (!campana) {
                res.status(404).json({ mensaje: 'Campaña no encontrada' });
                return;
            }
            await campana.update({ estado: ESTADO_CAMPANA.CERRADA, fecha_fin: campana.get('fecha_fin') || new Date() });
            res.status(200).json({ mensaje: 'Campaña cerrada', data: mapCampana(campana) });
        } catch (error) {
            handleError(res, error, 'Error al cerrar la campaña');
        }
    }

    public static async crearAcopio(req: Request, res: Response): Promise<void> {
        const usuario = getAuthUser(req);
        if (!usuario) {
            res.status(401).json({ mensaje: 'Usuario no autenticado' });
            return;
        }
        const datos = await DtoValidator.validateAndRespond(CrearAcopioDTO, req.body, res);
        if (!datos) {
            return;
        }
        const pago = toMoney(datos.pago || 0);
        const cantidad = toQty(datos.cantidad);
        const total = roundMoney(cantidad * toMoney(datos.precio_unitario));
        if (pago > total) {
            res.status(400).json({ mensaje: 'El pago no puede ser mayor al total' });
            return;
        }

        const transaction = await sequelize.transaction();
        try {
            const campana = await Campana.findByPk(datos.id_campana, { transaction });
            if (!campana || campana.get('estado') !== ESTADO_CAMPANA.ABIERTA) {
                await transaction.rollback();
                res.status(409).json({ mensaje: 'La campaña no existe o está cerrada' });
                return;
            }
            const proveedor = await Proveedor.findByPk(datos.id_proveedor, { transaction });
            if (!proveedor || !proveedor.get('activo')) {
                await transaction.rollback();
                res.status(400).json({ mensaje: 'El proveedor no existe o está inactivo' });
                return;
            }

            let caja = null;
            if (pago > 0) {
                caja = await obtenerCajaAbierta(transaction);
                if (!caja) {
                    await transaction.rollback();
                    res.status(409).json({ mensaje: 'Debe haber una caja abierta para registrar un pago' });
                    return;
                }
            }

            const acopio = await Acopio.create({
                id_campana: datos.id_campana,
                id_proveedor: datos.id_proveedor,
                id_producto: datos.id_producto || null,
                descripcion: datos.descripcion.trim(),
                cantidad,
                precio_unitario: toMoney(datos.precio_unitario),
                total,
                pago,
                metodo_pago: datos.metodo_pago || null,
                id_caja: caja ? caja.get('id') : null,
                observacion: datos.observacion || null,
                fecha: new Date(),
                id_usuario: usuario.id
            }, { transaction });

            if (pago > 0 && caja) {
                await registrarEgresoCaja({
                    transaction,
                    idCaja: caja.get('id') as number,
                    idUsuario: usuario.id,
                    categoria: CATEGORIA_EGRESO.PAGO_PROVEEDOR,
                    concepto: `Acopio campaña ${campana.get('nombre')} - ${proveedor.get('nombre')}`,
                    monto: pago,
                    metodoPago: datos.metodo_pago!,
                    origen: ORIGEN_MOVIMIENTO.COMPRA,
                    origenId: acopio.get('id') as number
                });
            }

            if (datos.id_producto) {
                const stock = await aplicarStock({
                    transaction,
                    idProducto: datos.id_producto,
                    delta: cantidad,
                    tipo: TIPO_INVENTARIO.ENTRADA,
                    origen: 'ACOPIO',
                    origenId: acopio.get('id') as number,
                    idUsuario: usuario.id,
                    observacion: datos.descripcion
                });
                if (!stock.ok) {
                    await transaction.rollback();
                    res.status(409).json({ mensaje: stock.mensaje });
                    return;
                }
            }

            await transaction.commit();
            const creado = await Acopio.findByPk(acopio.get('id') as number, {
                include: [
                    { model: Proveedor, as: 'proveedor', attributes: ['id', 'nombre'] },
                    { model: Productos, as: 'producto', attributes: ['id', 'nombre'] },
                    { model: User, as: 'usuario', attributes: ['id', 'username'] }
                ]
            });
            res.status(201).json({ mensaje: 'Acopio registrado', data: mapAcopio(creado) });
        } catch (error) {
            await transaction.rollback();
            handleError(res, error, 'Error al registrar el acopio');
        }
    }
}
