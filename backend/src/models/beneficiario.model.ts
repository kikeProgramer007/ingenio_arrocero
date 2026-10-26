import { DataTypes } from 'sequelize';
import sequelize from '../db/connection';

export const Beneficiario = sequelize.define('beneficiario', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    nombre: {
        type: DataTypes.STRING(120),
        allowNull: false,
        unique: true
    }
}, {
    tableName: 'beneficiarios',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default Beneficiario;
