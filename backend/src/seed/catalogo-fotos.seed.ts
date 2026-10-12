import { Acopio } from '../models/campana.model';
import { Compra } from '../models/compra.model';
import { CategoriaProducto } from '../models/categoria-producto.model';
import { Cliente } from '../models/cliente.model';
import { PagoProveedor } from '../models/pago-proveedor.model';
import { Productos } from '../models/productos.model';
import { Proveedor } from '../models/proveedor.model';
import { Productor } from '../models/productor.model';

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

const PROVEEDORES: { nombre: string; telefono?: string; observacion: string }[] = [
    { nombre: 'Shinken Takara', observacion: 'Proveedor' },
    { nombre: 'Yasushi Nakamura', observacion: 'Proveedor' },
    { nombre: 'Salvador Orellana', observacion: 'Proveedor' }
];

const PRODUCTORES: { nombre: string; telefono?: string; proveedor?: string }[] = [
    { nombre: 'Shyo Ogata', proveedor: 'Shinken Takara' },
    { nombre: 'Claudio García', proveedor: 'Shinken Takara' },
    { nombre: 'Manuel Saavedra', proveedor: 'Shinken Takara' },
    { nombre: 'Yasushi Nakamura', proveedor: 'Yasushi Nakamura' },
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

async function proveedorPorNombre(nombre: string): Promise<InstanceType<typeof Proveedor> | null> {
    return Proveedor.findOne({ where: { nombre } });
}

async function proveedorEnUso(id: number): Promise<boolean> {
    const [compras, pagos, acopios, productores] = await Promise.all([
        Compra.count({ where: { id_proveedor: id } }),
        PagoProveedor.count({ where: { id_proveedor: id } }),
        Acopio.count({ where: { id_proveedor: id } }),
        Productor.count({ where: { id_proveedor: id } })
    ]);
    return compras + pagos + acopios + productores > 0;
}

/** La boleta de cuenta: encabezado = proveedor; primera columna = sus productores. */
async function corregirProveedoresYProductores(): Promise<void> {
    const nombresCuenta = new Set(PROVEEDORES.map((p) => p.nombre));
    for (const item of PROVEEDORES) {
        const [row] = await Proveedor.findOrCreate({
            where: { nombre: item.nombre },
            defaults: {
                nombre: item.nombre,
                observacion: 'Proveedor',
                activo: true,
                path_imagen: '/uploads/defaults/proveedor.svg'
            }
        });
        await row.update({ observacion: 'Proveedor', activo: true });
    }

    const shinkenComoProductor = await Productor.findOne({ where: { nombre: 'Shinken Takara' } });
    if (shinkenComoProductor) {
        const usados = await Compra.count({ where: { id_productor: shinkenComoProductor.get('id') } });
        if (!usados) {
            await shinkenComoProductor.destroy();
        }
    }

    for (const item of PRODUCTORES) {
        const [row] = await Productor.findOrCreate({
            where: { nombre: item.nombre },
            defaults: {
                nombre: item.nombre,
                telefono: item.telefono || null,
                observacion: null,
                activo: true,
                path_imagen: '/uploads/defaults/proveedor.svg'
            }
        });
        if (item.proveedor) {
            const dueño = await proveedorPorNombre(item.proveedor);
            if (dueño) {
                await row.update({
                    id_proveedor: dueño.get('id'),
                    telefono: item.telefono || row.get('telefono'),
                    activo: true
                });
            }
        }
    }

    const extras = await Proveedor.findAll();
    for (const extra of extras) {
        const nombre = String(extra.get('nombre') || '');
        if (nombresCuenta.has(nombre)) {
            continue;
        }
        const id = Number(extra.get('id'));
        if (await proveedorEnUso(id)) {
            continue;
        }
        await extra.destroy();
    }
}

export async function seedCatalogoFotos(): Promise<{ productos: number; clientes: number; proveedores: number; productores: number }> {
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
                observacion: item.observacion,
                activo: true,
                path_imagen: '/uploads/defaults/proveedor.svg'
            }
        });
        if (created) {
            proveedores += 1;
        }
    }

    let productores = 0;
    for (const item of PRODUCTORES) {
        const dueño = item.proveedor ? await proveedorPorNombre(item.proveedor) : null;
        const [, created] = await Productor.findOrCreate({
            where: { nombre: item.nombre },
            defaults: {
                nombre: item.nombre,
                telefono: item.telefono || null,
                id_proveedor: dueño ? Number(dueño.get('id')) : null,
                observacion: null,
                activo: true,
                path_imagen: '/uploads/defaults/proveedor.svg'
            }
        });
        if (created) {
            productores += 1;
        }
    }

    await corregirProveedoresYProductores();

    return { productos, clientes, proveedores, productores };
}
