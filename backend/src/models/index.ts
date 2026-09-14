import sequelize from '../db/connection';

import { User } from './user';
import { Productos } from './productos.model';
import Programas from './programas.model';
import Perfil from './perfil.model';
import PerfilProgramas from './perfil_programas.model';
import { Caja } from './caja.model';
import { MovimientoCaja } from './movimiento-caja.model';
import { Cliente } from './cliente.model';
import { Venta } from './venta.model';
import { VentaDetalle } from './venta-detalle.model';
import { Cobranza } from './cobranza.model';
import { Proveedor } from './proveedor.model';
import { Compra } from './compra.model';
import { CompraDetalle } from './compra-detalle.model';
import { PagoProveedor } from './pago-proveedor.model';
import { Gasto } from './gasto.model';
import { CategoriaProducto } from './categoria-producto.model';
import { MovimientoInventario } from './movimiento-inventario.model';
import { Campana, Acopio } from './campana.model';
import { Produccion } from './produccion.model';

User.belongsTo(Perfil, { foreignKey: 'id_perfil' });
Perfil.hasMany(User, { foreignKey: 'id_perfil' });

Perfil.belongsToMany(Programas, {
  through: PerfilProgramas,
  foreignKey: 'id_perfil',
  otherKey: 'id_programa',
});
Programas.belongsToMany(Perfil, {
  through: PerfilProgramas,
  foreignKey: 'id_programa',
  otherKey: 'id_perfil',
});

Perfil.hasMany(PerfilProgramas, { foreignKey: 'id_perfil' });
PerfilProgramas.belongsTo(Programas, { foreignKey: 'id_programa' });

Caja.belongsTo(User, { foreignKey: 'id_usuario_apertura', as: 'usuarioApertura' });
Caja.belongsTo(User, { foreignKey: 'id_usuario_cierre', as: 'usuarioCierre' });
User.hasMany(Caja, { foreignKey: 'id_usuario_apertura', as: 'cajasApertura' });

Caja.hasMany(MovimientoCaja, { foreignKey: 'id_caja', as: 'movimientos' });
MovimientoCaja.belongsTo(Caja, { foreignKey: 'id_caja', as: 'caja' });
MovimientoCaja.belongsTo(User, { foreignKey: 'id_usuario', as: 'usuario' });
User.hasMany(MovimientoCaja, { foreignKey: 'id_usuario', as: 'movimientosCaja' });

Cliente.hasMany(Venta, { foreignKey: 'id_cliente', as: 'ventas' });
Venta.belongsTo(Cliente, { foreignKey: 'id_cliente', as: 'cliente' });
Venta.belongsTo(User, { foreignKey: 'id_usuario', as: 'usuario' });
User.hasMany(Venta, { foreignKey: 'id_usuario', as: 'ventas' });

Venta.hasMany(VentaDetalle, { foreignKey: 'id_venta', as: 'detalles' });
VentaDetalle.belongsTo(Venta, { foreignKey: 'id_venta', as: 'venta' });

Venta.hasMany(Cobranza, { foreignKey: 'id_venta', as: 'cobranzas' });
Cobranza.belongsTo(Venta, { foreignKey: 'id_venta', as: 'venta' });
Cobranza.belongsTo(Cliente, { foreignKey: 'id_cliente', as: 'cliente' });
Cobranza.belongsTo(Caja, { foreignKey: 'id_caja', as: 'caja' });
Cobranza.belongsTo(User, { foreignKey: 'id_usuario', as: 'usuario' });
Cliente.hasMany(Cobranza, { foreignKey: 'id_cliente', as: 'cobranzas' });

Proveedor.hasMany(Compra, { foreignKey: 'id_proveedor', as: 'compras' });
Compra.belongsTo(Proveedor, { foreignKey: 'id_proveedor', as: 'proveedor' });
Compra.belongsTo(User, { foreignKey: 'id_usuario', as: 'usuario' });
User.hasMany(Compra, { foreignKey: 'id_usuario', as: 'compras' });

Compra.hasMany(CompraDetalle, { foreignKey: 'id_compra', as: 'detalles' });
CompraDetalle.belongsTo(Compra, { foreignKey: 'id_compra', as: 'compra' });

Compra.hasMany(PagoProveedor, { foreignKey: 'id_compra', as: 'pagos' });
PagoProveedor.belongsTo(Compra, { foreignKey: 'id_compra', as: 'compra' });
PagoProveedor.belongsTo(Proveedor, { foreignKey: 'id_proveedor', as: 'proveedor' });
PagoProveedor.belongsTo(Caja, { foreignKey: 'id_caja', as: 'caja' });
PagoProveedor.belongsTo(User, { foreignKey: 'id_usuario', as: 'usuario' });
Proveedor.hasMany(PagoProveedor, { foreignKey: 'id_proveedor', as: 'pagos' });

Gasto.belongsTo(User, { foreignKey: 'id_usuario', as: 'usuario' });
Gasto.belongsTo(Caja, { foreignKey: 'id_caja', as: 'caja' });

CategoriaProducto.hasMany(Productos, { foreignKey: 'id_categoria', as: 'productos' });
Productos.belongsTo(CategoriaProducto, { foreignKey: 'id_categoria', as: 'categoria' });
Productos.hasMany(MovimientoInventario, { foreignKey: 'id_producto', as: 'movimientos' });
MovimientoInventario.belongsTo(Productos, { foreignKey: 'id_producto', as: 'producto' });
MovimientoInventario.belongsTo(User, { foreignKey: 'id_usuario', as: 'usuario' });

Campana.belongsTo(User, { foreignKey: 'id_usuario', as: 'usuario' });
Campana.hasMany(Acopio, { foreignKey: 'id_campana', as: 'acopios' });
Acopio.belongsTo(Campana, { foreignKey: 'id_campana', as: 'campana' });
Acopio.belongsTo(Proveedor, { foreignKey: 'id_proveedor', as: 'proveedor' });
Acopio.belongsTo(Productos, { foreignKey: 'id_producto', as: 'producto' });
Acopio.belongsTo(User, { foreignKey: 'id_usuario', as: 'usuario' });

Produccion.belongsTo(Productos, { foreignKey: 'id_producto_origen', as: 'productoOrigen' });
Produccion.belongsTo(Productos, { foreignKey: 'id_producto_destino', as: 'productoDestino' });
Produccion.belongsTo(User, { foreignKey: 'id_usuario', as: 'usuario' });

export {
  sequelize,
  User,
  Programas,
  Perfil,
  PerfilProgramas,
  Productos,
  Caja,
  MovimientoCaja,
  Cliente,
  Venta,
  VentaDetalle,
  Cobranza,
  Proveedor,
  Compra,
  CompraDetalle,
  PagoProveedor,
  Gasto,
  CategoriaProducto,
  MovimientoInventario,
  Campana,
  Acopio,
  Produccion
};
