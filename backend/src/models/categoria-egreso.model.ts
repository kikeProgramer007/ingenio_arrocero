import { DataTypes } from 'sequelize';
import sequelize from '../db/connection';

export const CategoriaEgreso = sequelize.define('categoria_egreso', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    tipo: {
        type: DataTypes.STRING(40),
        allowNull: false
    },
    nombre: {
        type: DataTypes.STRING(80),
        allowNull: false
    }
}, {
    tableName: 'categorias_egreso',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{ unique: true, fields: ['tipo', 'nombre'] }]
});

export default CategoriaEgreso;
