import { DataTypes } from 'sequelize';
import sequelize from '../db/connection';
import Perfil from './perfil.model';
import Programas from './programas.model';

export const PerfilProgramas = sequelize.define('perfil_programas', {
    id_perfil: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        references: {
            model: 'perfil',
            key: 'id'
        }
    },
    id_programa: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        references: {
            model: 'programas',
            key: 'id'
        }
    },
    permiso_lectura: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    permiso_escritura: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    permiso_modificacion: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    tableName: 'perfil_programas',
    timestamps: false
});

// Asociación muchos a muchos
//Perfil.belongsToMany(Programas, { through: PerfilProgramas, foreignKey: 'id_perfil' });
//Programas.belongsToMany(Perfil, { through: PerfilProgramas, foreignKey: 'id_programa' });

export default PerfilProgramas;
