import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Acopio, Campana, Compra, CompraDetalle, PagoProveedor, Productos, Proveedor, User } from '../models';
import { handleError } from '../utils/error.handler';
import { DtoValidator } from '../utils/dto.validador';
import { ActualizarProveedorDTO, CrearProveedorDTO } from '../dtos/proveedor.dto';
import { imagenParaGuardar, resolverImagen } from '../utils/imagen';
import { roundMoney, toMoney } from '../utils/money';
import { armarCuentaProveedor, esCompraServicio, extraerProductores, filtroCuentaDesdeQuery } from '../utils/cuenta-proveedor';
import { toQty } from '../utils/inventario';

function mapProveedor(proveedor: any) {
    return {
        id: proveedor.id,
        nombre: proveedor.nombre,
        nit_ci: proveedor.nit_ci,
        telefono: proveedor.telefono,
        direccion: proveedor.direccion,
        observacion: proveedor.observacion,
        activo: proveedor.activo,
        path_imagen: resolverImagen(proveedor.path_imagen, 'proveedor'),
        created_at: proveedor.created_at,
        updated_at: proveedor.updated_at
    };
}

export class ProveedorController {
    public static async listar(req: Request, res: Response): Promise<void> {
        try {
            const { q, activos } = req.query;
            const where: any = {};
            if (activos !== 'todos') {
                where.activo = true;
            }
            if (typeof q === 'string' && q.trim()) {
                where[Op.or] = [
                    { nombre: { [Op.like]: `%${q.trim()}%` } },
                    { nit_ci: { [Op.like]: `%${q.trim()}%` } }
                ];
            }
            const proveedores = await Proveedor.findAll({
                where,
                order: [['nombre', 'ASC']]
            });
            res.status(200).json(proveedores.map(mapProveedor));
        } catch (error) {
            handleError(res, error, 'Error al listar proveedores');
        }
    }

    public static async obtener(req: Request, res: Response): Promise<void> {
        try {
            const proveedor = await Proveedor.findByPk(req.params.id);
            if (!proveedor) {
                res.status(404).json({ mensaje: `No se encontró el proveedor con ID ${req.params.id}` });
                return;
            }
            res.status(200).json(mapProveedor(proveedor));
        } catch (error) {
            handleError(res, error, 'Error al obtener el proveedor');
        }
    }

    public static async cuenta(req: Request, res: Response): Promise<void> {
        try {
            const id = Number(req.params.id);
            const proveedor = await Proveedor.findByPk(id);
            if (!proveedor) {
                res.status(404).json({ mensaje: `No se encontró el proveedor con ID ${id}` });
                return;
            }
            const usuarioAtributos = ['id', 'username'];
            const filtro = filtroCuentaDesdeQuery(req.query);
            const [compras, pagos, acopios] = await Promise.all([
                Compra.findAll({
                    where: { id_proveedor: id },
                    include: [
                        { model: CompraDetalle, as: 'detalles', include: [{ model: Productos, as: 'producto', attributes: ['id', 'nombre', 'unidad_medida'] }] },
                        { model: Proveedor, as: 'productor', attributes: ['id', 'nombre'] },
                        { model: User, as: 'usuario', attributes: usuarioAtributos }
                    ],
                    order: [['fecha', 'DESC'], ['id', 'DESC']]
                }),
                PagoProveedor.findAll({
                    where: { id_proveedor: id },
                    include: [
                        {
                            model: Compra,
                            as: 'compra',
                            attributes: ['id', 'total', 'saldo_pendiente', 'estado', 'tipo_compra', 'tipo_cambio', 'total_usd', 'id_productor'],
                            include: [{ model: Proveedor, as: 'productor', attributes: ['id', 'nombre'] }]
                        },
                        { model: User, as: 'usuario', attributes: usuarioAtributos }
                    ],
                    order: [['fecha', 'DESC'], ['id', 'DESC']]
                }),
                Acopio.findAll({
                    where: { id_proveedor: id },
                    include: [
                        { model: Campana, as: 'campana', attributes: ['id', 'nombre'] },
                        { model: Productos, as: 'producto', attributes: ['id', 'nombre'] },
                        { model: User, as: 'usuario', attributes: usuarioAtributos }
                    ],
                    order: [['fecha', 'DESC'], ['id', 'DESC']]
                })
            ]);
            const cuenta = armarCuentaProveedor(compras, pagos, acopios, filtro);
            res.status(200).json({
                proveedor: mapProveedor(proveedor),
                productores: extraerProductores(compras),
                filtro,
                resumen: cuenta.resumen,
                inventario: cuenta.inventario,
                kardex: cuenta.kardex,
                compras: compras.map((c: any) => ({
                    id: c.id,
                    fecha: c.fecha,
                    total: toMoney(c.total),
                    pagado: roundMoney(toMoney(c.total) - toMoney(c.saldo_pendiente)),
                    saldo_pendiente: toMoney(c.saldo_pendiente),
                    estado: c.estado,
                    es_servicio: esCompraServicio(c),
                    observacion: c.observacion
                })),
                pagos: pagos.map((p: any) => ({
                    id: p.id,
                    fecha: p.fecha,
                    id_compra: p.id_compra,
                    monto: toMoney(p.monto),
                    metodo_pago: p.metodo_pago,
                    monto_efectivo: toMoney(p.monto_efectivo),
                    monto_qr: toMoney(p.monto_qr),
                    referencia: p.referencia,
                    observacion: p.observacion
                })),
                acopios: acopios.map((a: any) => ({
                    id: a.id,
                    fecha: a.fecha,
                    descripcion: a.descripcion,
                    cantidad: toQty(a.cantidad),
                    total: toMoney(a.total),
                    pago: toMoney(a.pago),
                    saldo: roundMoney(toMoney(a.total) - toMoney(a.pago)),
                    campana: a.campana ? { id: a.campana.id, nombre: a.campana.nombre } : null
                }))
            });
        } catch (error) {
            handleError(res, error, 'Error al obtener el estado de cuenta del proveedor');
        }
    }

    public static async crear(req: Request, res: Response): Promise<void> {
        const datos = await DtoValidator.validateAndRespond(CrearProveedorDTO, req.body, res);
        if (!datos) {
            return;
        }
        try {
            const proveedor = await Proveedor.create({
                nombre: datos.nombre.trim(),
                nit_ci: datos.nit_ci?.trim() || null,
                telefono: datos.telefono?.trim() || null,
                direccion: datos.direccion?.trim() || null,
                observacion: datos.observacion?.trim() || null,
                activo: datos.activo !== false,
                path_imagen: imagenParaGuardar(datos.path_imagen, 'proveedor')
            });
            res.status(201).json({ mensaje: 'Proveedor creado', data: mapProveedor(proveedor) });
        } catch (error) {
            handleError(res, error, 'Error al crear el proveedor');
        }
    }

    public static async actualizar(req: Request, res: Response): Promise<void> {
        const datos = await DtoValidator.validateAndRespond(ActualizarProveedorDTO, req.body, res);
        if (!datos) {
            return;
        }
        try {
            const proveedor = await Proveedor.findByPk(req.params.id);
            if (!proveedor) {
                res.status(404).json({ mensaje: `No se encontró el proveedor con ID ${req.params.id}` });
                return;
            }
            await proveedor.update({
                nombre: datos.nombre.trim(),
                nit_ci: datos.nit_ci?.trim() || null,
                telefono: datos.telefono?.trim() || null,
                direccion: datos.direccion?.trim() || null,
                observacion: datos.observacion?.trim() || null,
                activo: datos.activo ?? proveedor.get('activo'),
                path_imagen: imagenParaGuardar(datos.path_imagen ?? (proveedor.get('path_imagen') as string), 'proveedor')
            });
            res.status(200).json({ mensaje: 'Proveedor actualizado', data: mapProveedor(proveedor) });
        } catch (error) {
            handleError(res, error, 'Error al actualizar el proveedor');
        }
    }
}
