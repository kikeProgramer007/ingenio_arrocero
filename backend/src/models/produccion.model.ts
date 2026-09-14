import { DataTypes } from 'sequelize';
import sequelize from '../db/connection';

export const Produccion = sequelize.define('produccion', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    fecha: {
        type: DataTypes.DATE,
        allowNull: false
    },
    id_producto_origen: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'productos', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
    },
    cantidad_entrada: {
        type: DataTypes.DECIMAL(12, 3),
        allowNull: false
    },
    id_producto_destino: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'productos', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
    },
    cantidad_salida: {
        type: DataTypes.DECIMAL(12, 3),
        allowNull: false
    },
    merma: {
        type: DataTypes.DECIMAL(12, 3),
        allowNull: false,
        defaultValue: 0
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
    }
}, {
    tableName: 'producciones',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default Produccion;
