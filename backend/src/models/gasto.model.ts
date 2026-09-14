import { DataTypes } from 'sequelize';
import sequelize from '../db/connection';
import { CATEGORIA_EGRESO } from '../constants/caja.constants';

export const TIPO_GASTO = {
    GASTO_EMPRESA: CATEGORIA_EGRESO.GASTO_EMPRESA,
    RETIRO_PERSONAL: CATEGORIA_EGRESO.RETIRO_PERSONAL
} as const;

export const TIPOS_GASTO = Object.values(TIPO_GASTO);

export const Gasto = sequelize.define('gasto', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    tipo: {
        type: DataTypes.STRING(40),
        allowNull: false
    },
    concepto: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    categoria: {
        type: DataTypes.STRING(40),
        allowNull: true
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
    id_caja: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'cajas', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
    },
    fecha: {
        type: DataTypes.DATE,
        allowNull: false
    },
    id_usuario: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'user', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
    }
}, {
    tableName: 'gastos',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{ fields: ['tipo'] }, { fields: ['fecha'] }]
});

export default Gasto;
