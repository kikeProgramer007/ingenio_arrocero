import { CategoriaProducto } from '../models/categoria-producto.model';
import { Productos } from '../models/productos.model';

const CATEGORIAS = ['Arroz en chala', 'Arroz pilado', 'Insumos', 'Empaque'];

export async function seedInventarioBase(): Promise<void> {
    for (const nombre of CATEGORIAS) {
        await CategoriaProducto.findOrCreate({ where: { nombre }, defaults: { nombre } });
    }

    const chala = await CategoriaProducto.findOne({ where: { nombre: 'Arroz en chala' } });
    const pilado = await CategoriaProducto.findOne({ where: { nombre: 'Arroz pilado' } });

    if (chala) {
        await Productos.findOrCreate({
            where: { nombre: 'Arroz en chala' },
            defaults: {
                nombre: 'Arroz en chala',
                descripcion: 'Materia prima',
                precio_venta: 0,
                precio_compra: 0,
                stock: 0,
                stock_minimo: 0,
                unidad_medida: 'kg',
                path_imagen: '/uploads/defaults/producto.svg',
                id_categoria: chala.get('id'),
                eliminado: false
            }
        });
    }
    if (pilado) {
        await Productos.findOrCreate({
            where: { nombre: 'Arroz pilado' },
            defaults: {
                nombre: 'Arroz pilado',
                descripcion: 'Producto terminado',
                precio_venta: 0,
                precio_compra: 0,
                stock: 0,
                stock_minimo: 0,
                unidad_medida: 'kg',
                path_imagen: '/uploads/defaults/producto.svg',
                id_categoria: pilado.get('id'),
                eliminado: false
            }
        });
    }
}
