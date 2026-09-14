import { DataTypes } from 'sequelize';
import sequelize from '../db/connection';

export const PagoProveedor = sequelize.define('pago_proveedor', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    id_compra: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'compras',
            key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
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
    tableName: 'pagos_proveedor',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['id_compra'] },
        { fields: ['id_proveedor'] },
        { fields: ['fecha'] }
    ]
});

export default PagoProveedor;
