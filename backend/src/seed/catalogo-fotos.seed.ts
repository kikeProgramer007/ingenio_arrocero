import { CategoriaProducto } from '../models/categoria-producto.model';
import { Cliente } from '../models/cliente.model';
import { Productos } from '../models/productos.model';
import { Proveedor } from '../models/proveedor.model';

const PRODUCTOS_PILADO: { nombre: string; descripcion: string; precio_venta: number }[] = [
    { nombre: 'Oro transparente', descripcion: 'Arroz pilado', precio_venta: 0 },
    { nombre: '3/4 Oro', descripcion: 'Arroz pilado 3/4', precio_venta: 0 },
    { nombre: 'MAX-18 Premier', descripcion: 'Arroz pilado', precio_venta: 0 },
    { nombre: '3/4 MAX-18 Premier', descripcion: 'Arroz pilado 3/4', precio_venta: 0 },
    { nombre: 'Epagri Maxi', descripcion: 'Arroz pilado', precio_venta: 0 },
    { nombre: '3/4 Maxi Epagri', descripcion: 'Arroz pilado 3/4', precio_venta: 0 },
    { nombre: 'Khaja Premier MAC-18', descripcion: 'Arroz pilado', precio_venta: 460 },
    { nombre: '3/4 Premier', descripcion: 'Arroz pilado 3/4', precio_venta: 220 },
    { nombre: 'Granillo', descripcion: 'Subproducto', precio_venta: 150 },
    { nombre: 'Afrecho', descripcion: 'Subproducto', precio_venta: 0 },
    { nombre: 'Descarte', descripcion: 'Subproducto', precio_venta: 0 }
];

const CLIENTES = [
    'Adelia Terceros',
    'Ana María Tapia',
    'Aurora Escobar',
    'Bruno Aponte',
    'Dolly Carvajal',
    'Emilia Caero',
    'Gabriela Medina',
    'Grano de Oro',
    'Gregorio Bravo',
    'Yessica Rodríguez',
    'Melania Guaipa',
    'Teresa Quispe',
    'Ricardo Estrada',
    'Ariel Rojas',
    'Leoncio Cortez',
    'María Choque'
];

const PROVEEDORES: { nombre: string; telefono?: string; observacion?: string }[] = [
    { nombre: 'Shinken Takara', observacion: 'Proveedor' },
    { nombre: 'Yasushi Nakamura', observacion: 'Proveedor' },
    { nombre: 'Salvador Orellana', observacion: 'Proveedor' },
    { nombre: 'Shyo Ogata' },
    { nombre: 'Claudio García' },
    { nombre: 'Manuel Saavedra' },
    { nombre: 'Alberto Gutiérrez Roca' },
    { nombre: 'Andrés Saavedra' },
    { nombre: 'Choei Miyasato' },
    { nombre: 'Hidehiro Asato' },
    { nombre: 'Jaime Yusaku' },
    { nombre: 'Jorge Kishimoto' },
    { nombre: 'Julio Sakihama' },
    { nombre: 'Leandro Martins', telefono: '77394788' },
    { nombre: 'Masanobu Arakaki' },
    { nombre: 'Tomoki Yarara', telefono: '77888577' },
    { nombre: 'Tomohiro Taminato' },
    { nombre: 'Toru Higa' },
    { nombre: 'Yasuo Sadotayama' },
    { nombre: 'Yosikazu Kanemoto' }
];

export async function seedCatalogoFotos(): Promise<{ productos: number; clientes: number; proveedores: number }> {
    const pilado = await CategoriaProducto.findOne({ where: { nombre: 'Arroz pilado' } });
    let productos = 0;
    if (pilado) {
        const idCategoria = pilado.get('id') as number;
        for (const item of PRODUCTOS_PILADO) {
            const [, created] = await Productos.findOrCreate({
                where: { nombre: item.nombre },
                defaults: {
                    nombre: item.nombre,
                    descripcion: item.descripcion,
                    precio_venta: item.precio_venta,
                    precio_compra: 0,
                    stock: 0,
                    stock_minimo: 0,
                    unidad_medida: 'Quintal',
                    path_imagen: '/uploads/defaults/producto.svg',
                    id_categoria: idCategoria,
                    eliminado: false
                }
            });
            if (created) {
                productos += 1;
            }
        }
    }

    let clientes = 0;
    for (const nombre of CLIENTES) {
        const [, created] = await Cliente.findOrCreate({
            where: { nombre },
            defaults: {
                nombre,
                activo: true,
                path_imagen: '/uploads/defaults/cliente.svg'
            }
        });
        if (created) {
            clientes += 1;
        }
    }

    let proveedores = 0;
    for (const item of PROVEEDORES) {
        const [, created] = await Proveedor.findOrCreate({
            where: { nombre: item.nombre },
            defaults: {
                nombre: item.nombre,
                telefono: item.telefono || null,
                observacion: item.observacion || null,
                activo: true,
                path_imagen: '/uploads/defaults/proveedor.svg'
            }
        });
        if (created) {
            proveedores += 1;
        }
    }

    return { productos, clientes, proveedores };
}
