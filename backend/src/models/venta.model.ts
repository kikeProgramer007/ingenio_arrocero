import { DataTypes } from 'sequelize';
import sequelize from '../db/connection';
import { ESTADO_VENTA } from '../constants/venta.constants';

export const Venta = sequelize.define('venta', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    id_cliente: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'clientes',
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
        defaultValue: ESTADO_VENTA.PENDIENTE
    },
    observacion: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    plazo_dias: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    fecha_vencimiento: {
        type: DataTypes.DATEONLY,
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
    },
    id_caja: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    motivo_anulacion: {
        type: DataTypes.STRING(250),
        allowNull: true
    },
    fecha_anulacion: {
        type: DataTypes.DATE,
        allowNull: true
    },
    id_usuario_anulacion: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, {
    tableName: 'ventas',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['id_cliente'] },
        { fields: ['estado'] },
        { fields: ['fecha'] },
        { fields: ['fecha_vencimiento'] }
    ]
});

export default Venta;
