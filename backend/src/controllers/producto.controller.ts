import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { CategoriaProducto, CompraDetalle, MovimientoInventario, Productos, sequelize, User } from '../models';
import { esProductoEmpaque } from '../utils/empaque';
import { MENSAJE_UNIDAD_MEDIDA, normalizarUnidadMedida, unidadMedidaInvalida } from '../utils/unidad-medida';
import { AjusteStockDTO, CrearProductoDTO } from '../dtos/producto.dto';
import { handleError } from '../utils/error.handler';
import { DtoValidator } from '../utils/dto.validador';
import { getAuthUser } from '../utils/auth-user';
import { toMoney } from '../utils/money';
import { aplicarStock, TIPO_INVENTARIO, toQty } from '../utils/inventario';
import { imagenParaGuardar, resolverImagen } from '../utils/imagen';
import { ReservaProducto } from '../models/despacho.model';

function mapProducto(item: any) {
    return {
        id: item.id,
        nombre: item.nombre,
        descripcion: item.descripcion,
        precio_venta: toMoney(item.precio_venta),
        precio_compra: toMoney(item.precio_compra),
        stock: toQty(item.stock),
        stock_minimo: toQty(item.stock_minimo),
        unidad_medida: normalizarUnidadMedida(item.unidad_medida) || item.unidad_medida,
        path_imagen: resolverImagen(item.path_imagen, 'producto'),
        eliminado: item.eliminado,
        id_categoria: item.id_categoria,
        categoria: item.categoria ? { id: item.categoria.id, nombre: item.categoria.nombre } : null,
        bajo_minimo: toQty(item.stock) <= toQty(item.stock_minimo)
    };
}

/** Entradas y salidas acumuladas por producto. El tipo del movimiento define el signo. */
async function totalesPorProducto(ids: number[]): Promise<Map<number, { entradas: number; salidas: number }>> {
    const totales = new Map<number, { entradas: number; salidas: number }>();
    if (!ids.length) {
        return totales;
    }
    const filas = await MovimientoInventario.findAll({
        attributes: [
            'id_producto',
            'tipo',
            [sequelize.fn('SUM', sequelize.col('cantidad')), 'total']
        ],
        where: { id_producto: { [Op.in]: ids } },
        group: ['id_producto', 'tipo'],
        raw: true
    });
    for (const fila of filas as any[]) {
        const id = Number(fila.id_producto);
        const acum = totales.get(id) || { entradas: 0, salidas: 0 };
        if (fila.tipo === TIPO_INVENTARIO.SALIDA) {
            acum.salidas = toQty(acum.salidas + toQty(fila.total));
        } else if (fila.tipo === TIPO_INVENTARIO.ENTRADA) {
            acum.entradas = toQty(acum.entradas + toQty(fila.total));
        }
        totales.set(id, acum);
    }
    return totales;
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
            if (typeof req.query.id_categoria === 'string' && req.query.id_categoria) {
                where.id_categoria = Number(req.query.id_categoria);
            }
            const productos = await Productos.findAll({
                where,
                include: [{ model: CategoriaProducto, as: 'categoria' }],
                order: [['nombre', 'ASC']]
            });
            const reservas = await ReservaProducto.findAll();
            const porProducto = new Map(reservas.map(r => [Number(r.get('id_producto')), toQty(r.get('cantidad'))]));
            const lista = productos.map(p => {
                const item = mapProducto(p);
                const reservado = porProducto.get(item.id) || 0;
                return { ...item, reservado, disponible: toQty(item.stock - reservado), bajo_minimo: toQty(item.stock - reservado) <= item.stock_minimo };
            });
            if (req.query.totales === '1') {
                const totales = await totalesPorProducto(lista.map((p) => p.id));
                res.status(200).json(lista.map((p) => ({ ...p, ...(totales.get(p.id) || { entradas: 0, salidas: 0 }) })));
                return;
            }
            res.status(200).json(lista);
        } catch (error) {
            handleError(res, error, 'Error al listar productos');
        }
    }

    public static async unidadesInvalidas(_req: Request, res: Response): Promise<void> {
        try {
            const [productos, detalles] = await Promise.all([
                Productos.findAll({
                    where: { eliminado: false },
                    attributes: ['id', 'nombre', 'unidad_medida'],
                    order: [['nombre', 'ASC']]
                }),
                CompraDetalle.findAll({
                    attributes: ['id', 'id_compra', 'descripcion', 'unidad'],
                    order: [['id', 'DESC']],
                    limit: 500
                })
            ]);
            const invalidos = [
                ...productos
                    .filter((p: any) => unidadMedidaInvalida(p.unidad_medida))
                    .map((p: any) => ({
                        origen: 'producto',
                        id: p.id,
                        nombre: p.nombre,
                        unidad: String(p.unidad_medida || ''),
                        detalle: 'Inventario'
                    })),
                ...detalles
                    .filter((d: any) => unidadMedidaInvalida(d.unidad))
                    .map((d: any) => ({
                        origen: 'compra_detalle',
                        id: d.id,
                        nombre: d.descripcion,
                        unidad: String(d.unidad || ''),
                        detalle: `Compra #${d.id_compra}`
                    }))
            ];
            res.status(200).json({
                mensaje: invalidos.length
                    ? `${invalidos.length} registro(s) con unidad inválida. ${MENSAJE_UNIDAD_MEDIDA}`
                    : 'No hay unidades de medida inválidas.',
                data: invalidos
            });
        } catch (error) {
            handleError(res, error, 'Error al detectar unidades inválidas');
        }
    }

    public static async crear(req: Request, res: Response): Promise<void> {
        const datos = await DtoValidator.validateAndRespond(CrearProductoDTO, req.body, res);
        if (!datos) {
            return;
        }
        const unidad = normalizarUnidadMedida(datos.unidad_medida) || 'Kilo';
        if (unidadMedidaInvalida(unidad)) {
            res.status(400).json({ mensaje: MENSAJE_UNIDAD_MEDIDA });
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
                unidad_medida: unidad,
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
        const transaction = await sequelize.transaction();
        try {
            const producto = await Productos.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
            if (!producto || producto.get('eliminado')) {
                await transaction.rollback();
                res.status(404).json({ mensaje: 'Producto no encontrado' });
                return;
            }
            const unidad = normalizarUnidadMedida(datos.unidad_medida) || normalizarUnidadMedida(producto.get('unidad_medida')) || 'Kilo';
            if (unidadMedidaInvalida(unidad)) {
                await transaction.rollback();
                res.status(400).json({ mensaje: MENSAJE_UNIDAD_MEDIDA });
                return;
            }
            const reserva = await ReservaProducto.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
            if (Number(reserva?.get('cantidad') || 0) > 0 && unidad !== producto.get('unidad_medida')) {
                await transaction.rollback(); res.status(409).json({ mensaje: 'No cambie la unidad de un producto con reservas pendientes' }); return;
            }
            await producto.update({
                nombre: datos.nombre.trim(),
                descripcion: datos.descripcion?.trim() || '',
                precio_venta: toMoney(datos.precio_venta),
                precio_compra: toMoney(datos.precio_compra),
                stock_minimo: toQty(datos.stock_minimo ?? producto.get('stock_minimo')),
                unidad_medida: unidad,
                path_imagen: imagenParaGuardar(datos.path_imagen ?? (producto.get('path_imagen') as string), 'producto'),
                id_categoria: datos.id_categoria ?? producto.get('id_categoria')
            }, { transaction });
            await transaction.commit();
            const actualizado = await Productos.findByPk(producto.get('id') as number, {
                include: [{ model: CategoriaProducto, as: 'categoria' }]
            });
            res.status(200).json({ mensaje: 'Producto actualizado', data: mapProducto(actualizado) });
        } catch (error) {
            if (!(transaction as any).finished) await transaction.rollback();
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
        const productoAjuste = await Productos.findByPk(req.params.id, {
            include: [{ model: CategoriaProducto, as: 'categoria' }]
        });
        if (!productoAjuste || productoAjuste.get('eliminado')) {
            res.status(404).json({ mensaje: 'Producto no encontrado' });
            return;
        }
        if (cantidad > 0 && esProductoEmpaque({
            nombre: productoAjuste.get('nombre'),
            categoria: (productoAjuste as any).categoria
        })) {
            res.status(400).json({ mensaje: 'Las bolsas entran por Compras (tipo Bolsas y empaques), no por ajuste.' });
            return;
        }
        const transaction = await sequelize.transaction();
        try {
            const stock = await aplicarStock({
                transaction,
                idProducto: Number(req.params.id),
                delta: cantidad,
                tipo: cantidad > 0 ? TIPO_INVENTARIO.ENTRADA : TIPO_INVENTARIO.SALIDA,
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
                    { model: User, as: 'usuario', attributes: ['id', 'username', 'nombre'] }
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
