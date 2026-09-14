import { DataTypes } from 'sequelize';
import sequelize from '../db/connection';

export const Productos = sequelize.define('productos', {
    id: { 
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    nombre: { 
        type: DataTypes.STRING(150),
        allowNull: false,
    },
    descripcion: { 
        type: DataTypes.TEXT,
        allowNull: true
    },
    precio_venta: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0
    },
    precio_compra: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0
    },
    stock: {
        type: DataTypes.DECIMAL(12, 3),
        allowNull: false,
        defaultValue: 0
    },
    stock_minimo:{
        type: DataTypes.DECIMAL(12, 3),
        allowNull: false,
        defaultValue: 0
    },
    unidad_medida: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: 'kg'
    },
    path_imagen:{
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: '/uploads/defaults/producto.svg'
    },
    eliminado: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    id_categoria: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
}, 
{
    tableName: 'productos',     
    timestamps: true,
    createdAt: 'fecha_creacion',
    updatedAt: 'fecha_modificacion'
});
