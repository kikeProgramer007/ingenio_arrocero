import { DataTypes } from 'sequelize';
import sequelize from '../db/connection';

export const ESTADO_CAMPANA = {
    ABIERTA: 'ABIERTA',
    CERRADA: 'CERRADA'
} as const;

export const Campana = sequelize.define('campana', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    nombre: {
        type: DataTypes.STRING(150),
        allowNull: false
    },
    fecha_inicio: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    fecha_fin: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    meta_cantidad: {
        type: DataTypes.DECIMAL(12, 3),
        allowNull: true
    },
    estado: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: ESTADO_CAMPANA.ABIERTA
    },
    observacion: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    id_usuario: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'user', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
    }
}, {
    tableName: 'campanas',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export const Acopio = sequelize.define('acopio', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    id_campana: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'campanas', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
    },
    id_proveedor: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'proveedores', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
    },
    id_producto: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'productos', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
    },
    descripcion: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    cantidad: {
        type: DataTypes.DECIMAL(12, 3),
        allowNull: false
    },
    precio_unitario: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false
    },
    total: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false
    },
    metodo_pago: {
        type: DataTypes.STRING(30),
        allowNull: true
    },
    pago: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0
    },
    id_caja: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'cajas', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
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
        references: { model: 'user', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
    }
}, {
    tableName: 'acopios',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default Campana;
