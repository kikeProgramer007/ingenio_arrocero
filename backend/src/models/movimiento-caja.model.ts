import { DataTypes } from 'sequelize';
import sequelize from '../db/connection';
import { ORIGEN_MOVIMIENTO } from '../constants/caja.constants';

export const MovimientoCaja = sequelize.define('movimiento_caja', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
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
    tipo: {
        type: DataTypes.STRING(20),
        allowNull: false
    },
    categoria: {
        type: DataTypes.STRING(40),
        allowNull: false
    },
    concepto: {
        type: DataTypes.STRING(200),
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
    referencia: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    observacion: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    origen: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: ORIGEN_MOVIMIENTO.MANUAL
    },
    origen_id: {
        type: DataTypes.INTEGER,
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
    fecha: {
        type: DataTypes.DATE,
        allowNull: false
    }
}, {
    tableName: 'movimientos_caja',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['id_caja', 'fecha'] }
    ]
});

export default MovimientoCaja;
