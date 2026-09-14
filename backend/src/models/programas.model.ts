import { DataTypes } from 'sequelize';
import sequelize from '../db/connection';

export const Programas = sequelize.define('programas', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    id_padre: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'programas',
            key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
    },
    nombre_programa: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    url: {
        type: DataTypes.STRING(255)
    },
    class_icon: {
        type: DataTypes.STRING(100)
    },
    es_expandible: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    nro_posicion: {
        type: DataTypes.INTEGER
    },
    eliminado: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    tableName: 'programas',
    timestamps: false
});

export default Programas;
