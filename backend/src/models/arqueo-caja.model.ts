import { DataTypes } from 'sequelize';
import sequelize from '../db/connection';

/** Arqueo de consulta. No cierra la caja ni interrumpe sus movimientos. */
export const ArqueoCaja = sequelize.define('arqueo_caja', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    id_caja: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    saldo_esperado: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false
    },
    saldo_contado: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false
    },
    diferencia: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false
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
        allowNull: false
    }
}, {
    tableName: 'arqueos_caja',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{ fields: ['id_caja', 'fecha'] }]
});

export default ArqueoCaja;
