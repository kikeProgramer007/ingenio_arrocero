import { DataTypes } from 'sequelize';
import sequelize from '../db/connection';

/** Amortización de un gasto/servicio registrado a crédito. Cada pago sí sale de caja. */
export const PagoGasto = sequelize.define('pago_gasto', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    id_gasto: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    id_caja: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    monto: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false
    },
    metodo_pago: {
        type: DataTypes.STRING(30),
        allowNull: false
    },
    monto_efectivo: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true
    },
    monto_qr: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true
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
        allowNull: false
    }
}, {
    tableName: 'pagos_gasto',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{ fields: ['id_gasto'] }, { fields: ['fecha'] }]
});

export default PagoGasto;
