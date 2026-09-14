import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { CategoriaProducto, MovimientoInventario, Productos, sequelize, User } from '../models';
import { AjusteStockDTO, CrearProductoDTO } from '../dtos/producto.dto';
import { handleError } from '../utils/error.handler';
import { DtoValidator } from '../utils/dto.validador';
import { getAuthUser } from '../utils/auth-user';
import { toMoney } from '../utils/money';
import { aplicarStock, TIPO_INVENTARIO, toQty } from '../utils/inventario';
import { imagenParaGuardar, resolverImagen } from '../utils/imagen';

function mapProducto(item: any) {
    return {
        id: item.id,
        nombre: item.nombre,
        descripcion: item.descripcion,
        precio_venta: toMoney(item.precio_venta),
        precio_compra: toMoney(item.precio_compra),
        stock: toQty(item.stock),
        stock_minimo: toQty(item.stock_minimo),
        unidad_medida: item.unidad_medida,
        path_imagen: resolverImagen(item.path_imagen, 'producto'),
        eliminado: item.eliminado,
        id_categoria: item.id_categoria,
        categoria: item.categoria ? { id: item.categoria.id, nombre: item.categoria.nombre } : null,
        bajo_minimo: toQty(item.stock) <= toQty(item.stock_minimo)
    };
}

export class ProductoController {
    public static async categorias(_req: Request, res: Response): Promise<void> {
        try {
            const categorias = await CategoriaProducto.findAll({ order: [['nombre', 'ASC']] });
            res.status(200).json(categorias);
        } catch (error) {
            handleError(res, error, 'Error al listar categorías');
        }
    }

    public static async listar(req: Request, res: Response): Promise<void> {
        try {
            const where: any = { eliminado: false };
            if (typeof req.query.q === 'string' && req.query.q.trim()) {
                where.nombre = { [Op.like]: `%${req.query.q.trim()}%` };
            }
            const productos = await Productos.findAll({
                where,
                include: [{ model: CategoriaProducto, as: 'categoria' }],
                order: [['nombre', 'ASC']]
            });
            res.status(200).json(productos.map(mapProducto));
        } catch (error) {
            handleError(res, error, 'Error al listar productos');
        }
    }

    public static async crear(req: Request, res: Response): Promise<void> {
        const datos = await DtoValidator.validateAndRespond(CrearProductoDTO, req.body, res);
        if (!datos) {
            return;
        }
        try {
            const producto = await Productos.create({
                nombre: datos.nombre.trim(),
                descripcion: datos.descripcion?.trim() || '',
                precio_venta: toMoney(datos.precio_venta),
                precio_compra: toMoney(datos.precio_compra),
                stock: toQty(datos.stock || 0),
                stock_minimo: toQty(datos.stock_minimo || 0),
                unidad_medida: datos.unidad_medida?.trim() || 'kg',
                path_imagen: imagenParaGuardar(datos.path_imagen, 'producto'),
                id_categoria: datos.id_categoria || null,
                eliminado: false
            });
            const creado = await Productos.findByPk(producto.get('id') as number, {
                include: [{ model: CategoriaProducto, as: 'categoria' }]
            });
            res.status(201).json({ mensaje: 'Producto creado', data: mapProducto(creado) });
        } catch (error) {
            handleError(res, error, 'Error al crear el producto');
        }
    }

    public static async actualizar(req: Request, res: Response): Promise<void> {
        const datos = await DtoValidator.validateAndRespond(CrearProductoDTO, req.body, res);
        if (!datos) {
            return;
        }
        try {
            const producto = await Productos.findByPk(req.params.id);
            if (!producto || producto.get('eliminado')) {
                res.status(404).json({ mensaje: 'Producto no encontrado' });
                return;
            }
            await producto.update({
                nombre: datos.nombre.trim(),
                descripcion: datos.descripcion?.trim() || '',
                precio_venta: toMoney(datos.precio_venta),
                precio_compra: toMoney(datos.precio_compra),
                stock_minimo: toQty(datos.stock_minimo ?? producto.get('stock_minimo')),
                unidad_medida: datos.unidad_medida?.trim() || producto.get('unidad_medida'),
                path_imagen: imagenParaGuardar(datos.path_imagen ?? (producto.get('path_imagen') as string), 'producto'),
                id_categoria: datos.id_categoria ?? producto.get('id_categoria')
            });
            const actualizado = await Productos.findByPk(producto.get('id') as number, {
                include: [{ model: CategoriaProducto, as: 'categoria' }]
            });
            res.status(200).json({ mensaje: 'Producto actualizado', data: mapProducto(actualizado) });
        } catch (error) {
            handleError(res, error, 'Error al actualizar el producto');
        }
    }

    public static async ajustar(req: Request, res: Response): Promise<void> {
        const usuario = getAuthUser(req);
        if (!usuario) {
            res.status(401).json({ mensaje: 'Usuario no autenticado' });
            return;
        }
        const datos = await DtoValidator.validateAndRespond(AjusteStockDTO, req.body, res);
        if (!datos) {
            return;
        }
        const cantidad = toQty(datos.cantidad);
        if (cantidad === 0) {
            res.status(400).json({ mensaje: 'La cantidad de ajuste no puede ser 0' });
            return;
        }
        const transaction = await sequelize.transaction();
        try {
            const stock = await aplicarStock({
                transaction,
                idProducto: Number(req.params.id),
                delta: cantidad,
                tipo: TIPO_INVENTARIO.AJUSTE,
                origen: 'AJUSTE',
                origenId: Number(req.params.id),
                idUsuario: usuario.id,
                observacion: datos.observacion || null
            });
            if (!stock.ok) {
                await transaction.rollback();
                res.status(409).json({ mensaje: stock.mensaje });
                return;
            }
            await transaction.commit();
            const producto = await Productos.findByPk(req.params.id, {
                include: [{ model: CategoriaProducto, as: 'categoria' }]
            });
            res.status(200).json({ mensaje: 'Stock ajustado', data: mapProducto(producto) });
        } catch (error) {
            await transaction.rollback();
            handleError(res, error, 'Error al ajustar stock');
        }
    }

    public static async kardex(req: Request, res: Response): Promise<void> {
        try {
            const where: any = {};
            if (req.params.id) {
                where.id_producto = req.params.id;
            }
            const movimientos = await MovimientoInventario.findAll({
                where,
                include: [
                    { model: Productos, as: 'producto', attributes: ['id', 'nombre', 'unidad_medida'] },
                    { model: User, as: 'usuario', attributes: ['id', 'username'] }
                ],
                order: [['fecha', 'DESC'], ['id', 'DESC']],
                limit: 200
            });
            res.status(200).json(movimientos.map((item: any) => ({
                id: item.id,
                id_producto: item.id_producto,
                tipo: item.tipo,
                cantidad: toQty(item.cantidad),
                stock_resultante: toQty(item.stock_resultante),
                origen: item.origen,
                observacion: item.observacion,
                fecha: item.fecha,
                producto: item.producto,
                usuario: item.usuario
            })));
        } catch (error) {
            handleError(res, error, 'Error al listar el kardex');
        }
    }
}
