import { DataTypes } from 'sequelize';
import sequelize from '../db/connection';
import { ESTADO_CAJA } from '../constants/caja.constants';

export const Caja = sequelize.define('caja', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    fecha_apertura: {
        type: DataTypes.DATE,
        allowNull: false
    },
    fecha_cierre: {
        type: DataTypes.DATE,
        allowNull: true
    },
    saldo_inicial: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0
    },
    saldo_esperado: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true
    },
    saldo_contado: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true
    },
    diferencia: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true
    },
    estado: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: ESTADO_CAJA.ABIERTA
    },
    id_usuario_apertura: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'user',
            key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
    },
    id_usuario_cierre: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'user',
            key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
    },
    observacion: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'cajas',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['estado'] }
    ]
});

export default Caja;
