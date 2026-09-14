import { DataTypes } from 'sequelize';
import sequelize from '../db/connection';

export const Cobranza = sequelize.define('cobranza', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    id_venta: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'ventas',
            key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
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
    id_caja: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'cajas',
            key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
    },
    monto: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false
    },
    metodo_pago: {
        type: DataTypes.STRING(30),
        allowNull: false
    },
    referencia: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    observacion: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    fecha: {
        type: DataTypes.DATE,
        allowNull: false
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
    tableName: 'cobranzas',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['id_venta'] },
        { fields: ['id_cliente'] },
        { fields: ['fecha'] }
    ]
});

export default Cobranza;
