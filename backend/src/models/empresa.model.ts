import { DataTypes } from 'sequelize';
import sequelize from '../db/connection';

export const Empresa = sequelize.define('empresa', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    nombre: {
        type: DataTypes.STRING(150),
        allowNull: false
    },
    nombre_corto: {
        type: DataTypes.STRING(80),
        allowNull: true
    },
    slogan: {
        type: DataTypes.STRING(150),
        allowNull: true
    },
    titular: {
        type: DataTypes.STRING(150),
        allowNull: true
    },
    nit: {
        type: DataTypes.STRING(30),
        allowNull: true
    },
    direccion: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    telefono: {
        type: DataTypes.STRING(80),
        allowNull: true
    },
    ciudad: {
        type: DataTypes.STRING(80),
        allowNull: true
    },
    email: {
        type: DataTypes.STRING(120),
        allowNull: true
    },
    path_logo: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: '/uploads/defaults/logotipo.jpeg'
    },
    formato_nota: {
        type: DataTypes.STRING(8),
        allowNull: false,
        defaultValue: '11'
    },
    tipo_cambio: {
        type: DataTypes.DECIMAL(12, 4),
        allowNull: false,
        defaultValue: 9.96
    }
}, {
    tableName: 'empresa',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default Empresa;
