import { DataTypes } from 'sequelize';
import sequelize from '../db/connection';

export const Productor = sequelize.define('productor', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    id_proveedor: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'proveedores',
            key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
    },
    nombre: {
        type: DataTypes.STRING(150),
        allowNull: false
    },
    nit_ci: {
        type: DataTypes.STRING(30),
        allowNull: true
    },
    telefono: {
        type: DataTypes.STRING(30),
        allowNull: true
    },
    direccion: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    observacion: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    activo: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    path_imagen: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: '/uploads/defaults/proveedor.svg'
    }
}, {
    tableName: 'productores',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{ fields: ['nombre'] }, { fields: ['id_proveedor'] }]
});

export default Productor;
