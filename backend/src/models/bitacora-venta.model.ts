import { DataTypes } from 'sequelize';
import sequelize from '../db/connection';

export const BitacoraVenta = sequelize.define('bitacora_venta', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    id_venta: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    id_usuario: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    id_caja: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    accion: {
        type: DataTypes.STRING(40),
        allowNull: false
    },
    motivo: {
        type: DataTypes.STRING(250),
        allowNull: false
    },
    anterior: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    nuevo: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    fecha: {
        type: DataTypes.DATE,
        allowNull: false
    }
}, {
    tableName: 'bitacora_ventas',
    timestamps: false
});
