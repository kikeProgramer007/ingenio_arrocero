import { DataTypes } from 'sequelize';
import sequelize from '../db/connection';

export const TIPO_INVENTARIO = {
    ENTRADA: 'ENTRADA',
    SALIDA: 'SALIDA',
    AJUSTE: 'AJUSTE'
} as const;

export const MovimientoInventario = sequelize.define('movimiento_inventario', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    id_producto: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'productos', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
    },
    tipo: {
        type: DataTypes.STRING(20),
        allowNull: false
    },
    cantidad: {
        type: DataTypes.DECIMAL(12, 3),
        allowNull: false
    },
    stock_resultante: {
        type: DataTypes.DECIMAL(12, 3),
        allowNull: false
    },
    origen: {
        type: DataTypes.STRING(40),
        allowNull: false
    },
    origen_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    observacion: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    id_usuario: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'user', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
    },
    fecha: {
        type: DataTypes.DATE,
        allowNull: false
    }
}, {
    tableName: 'movimientos_inventario',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{ fields: ['id_producto', 'fecha'] }]
});

export default MovimientoInventario;
