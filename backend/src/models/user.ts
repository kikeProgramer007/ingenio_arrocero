import { DataTypes } from 'sequelize';
import sequelize from '../db/connection';
//import { Empleado } from './empleado';
import Perfil from './perfil.model';

export const User = sequelize.define('user', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    username: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    nombre: {
        type: DataTypes.STRING(120),
        allowNull: true
    },
    ci: {
        type: DataTypes.STRING(30),
        allowNull: true
    },
    telefono: {
        type: DataTypes.STRING(30),
        allowNull: true
    },
    email: {
        type: DataTypes.STRING(120),
        allowNull: true
    },
    cargo: {
        type: DataTypes.STRING(80),
        allowNull: true
    },
    activo: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    id_perfil: {
        type: DataTypes.INTEGER,
        references: {
            model: 'perfil',
            key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
    },
    eliminado: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
   
}, {
    tableName: 'user',
    timestamps: true
} )


// Relación usuario-perfil

//User.belongsTo(Perfil, { foreignKey: 'id_perfil' });
//Perfil.hasMany(User, { foreignKey: 'id_perfil' });
