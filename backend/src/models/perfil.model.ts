import { DataTypes } from 'sequelize';
import sequelize from '../db/connection';
import { User } from './user';
import PerfilProgramas from './perfil_programas.model';

export const Perfil = sequelize.define('perfil', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nombre: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    eliminado: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    tableName: 'perfil',
    timestamps: false
});

export default Perfil;


