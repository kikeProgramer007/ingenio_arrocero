import { DataTypes } from "sequelize";
import sequelize from "../db/connection";

const timestamps = {
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
};
export const VentaEntrega = sequelize.define(
  "venta_entrega",
  {
    id_venta: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      references: { model: "ventas", key: "id" },
    },
    clave: { type: DataTypes.STRING(80), allowNull: false, unique: true },
    solicitud: { type: DataTypes.STRING(64), allowNull: false },
    estado: { type: DataTypes.STRING(20), allowNull: false },
  },
  { ...timestamps, tableName: "ventas_entrega" },
);

export const ReservaProducto = sequelize.define(
  "reserva_producto",
  {
    id_producto: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      references: { model: "productos", key: "id" },
    },
    cantidad: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
      defaultValue: 0,
    },
  },
  { ...timestamps, tableName: "reservas_producto" },
);

export const ReservaVenta = sequelize.define(
  "reserva_venta",
  {
    id_detalle: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      references: { model: "venta_detalles", key: "id" },
    },
    id_venta: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "ventas", key: "id" },
    },
    id_producto: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "productos", key: "id" },
    },
    unidad: { type: DataTypes.STRING(30), allowNull: false },
    vendido: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
    entregado: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
      defaultValue: 0,
    },
    pendiente: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
  },
  {
    ...timestamps,
    tableName: "reservas_venta",
    indexes: [{ fields: ["id_producto"] }, { fields: ["id_venta"] }],
  },
);

export const Despacho = sequelize.define(
  "despacho",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    id_venta: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "ventas", key: "id" },
    },
    clave: { type: DataTypes.STRING(80), allowNull: false, unique: true },
    fecha: { type: DataTypes.DATE, allowNull: false },
    persona_retira: { type: DataTypes.STRING(150), allowNull: false },
    ci: { type: DataTypes.STRING(30), allowNull: true },
    marca: { type: DataTypes.STRING(80), allowNull: true },
    color: { type: DataTypes.STRING(40), allowNull: true },
    destino: { type: DataTypes.STRING(150), allowNull: true },
    id_usuario: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "user", key: "id" },
    },
    chofer: { type: DataTypes.STRING(150), allowNull: true },
    placa: { type: DataTypes.STRING(30), allowNull: true },
    observacion: { type: DataTypes.TEXT, allowNull: true },
    solicitud: { type: DataTypes.TEXT, allowNull: false },
    lineas: { type: DataTypes.JSON, allowNull: false },
  },
  {
    ...timestamps,
    tableName: "despachos",
    indexes: [{ fields: ["id_venta"] }],
  },
);
