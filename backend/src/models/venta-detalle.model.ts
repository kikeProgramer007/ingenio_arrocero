import { DataTypes } from 'sequelize';
import sequelize from '../db/connection';

export const VentaDetalle = sequelize.define('venta_detalle', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    id_venta: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'ventas',
            key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
    },
    descripcion: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    id_producto: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'productos', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
    },
    cantidad: {
        type: DataTypes.DECIMAL(12, 3),
        allowNull: false
    },
    precio_unitario: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false
    },
    subtotal: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false
    }
}, {
    tableName: 'venta_detalles',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default VentaDetalle;
