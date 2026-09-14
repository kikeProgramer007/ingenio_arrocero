import { DataTypes } from 'sequelize';
import sequelize from '../db/connection';

export const CategoriaProducto = sequelize.define('categoria_producto', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    nombre: {
        type: DataTypes.STRING(80),
        allowNull: false,
        unique: true
    }
}, {
    tableName: 'categorias_producto',
    timestamps: false
});

export default CategoriaProducto;
