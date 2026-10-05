import { DataTypes } from 'sequelize';
import sequelize from '../db/connection';
import { ESTADO_COMPRA } from '../constants/compra.constants';

export const Compra = sequelize.define('compra', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    id_proveedor: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'proveedores',
            key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
    },
    fecha: {
        type: DataTypes.DATE,
        allowNull: false
    },
    total: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0
    },
    saldo_pendiente: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0
    },
    estado: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: ESTADO_COMPRA.PENDIENTE
    },
    observacion: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    concepto: {
        type: DataTypes.STRING(40),
        allowNull: true
    },
    boleta: {
        type: DataTypes.STRING(40),
        allowNull: true
    },
    chofer: {
        type: DataTypes.STRING(120),
        allowNull: true
    },
    placa: {
        type: DataTypes.STRING(30),
        allowNull: true
    },
    fanegas: {
        type: DataTypes.DECIMAL(12, 3),
        allowNull: true
    },
    id_usuario: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'user',
            key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
    }
}, {
    tableName: 'compras',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['id_proveedor'] },
        { fields: ['estado'] },
        { fields: ['fecha'] }
    ]
});

export default Compra;
