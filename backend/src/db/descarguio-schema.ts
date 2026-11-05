import { DataTypes, ModelAttributeColumnOptions } from 'sequelize';

export const VERSION_DESCARGUIOS = '20261105-produccion-descarguios';
const ref = (tabla: string): ModelAttributeColumnOptions => ({ type: DataTypes.INTEGER, allowNull: true,
    references: { model: tabla, key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
export const COLUMNAS_DESCARGUIO: Record<string, ModelAttributeColumnOptions> = {
    id_producto: ref('productos'), cantidad: { type: DataTypes.DECIMAL(18, 3).UNSIGNED, allowNull: true },
    unidad: { type: DataTypes.STRING(30), allowNull: true }, variedad: { type: DataTypes.STRING(100), allowNull: true },
    localidad: { type: DataTypes.STRING(200), allowNull: true }, ubicacion_detalle: { type: DataTypes.STRING(200), allowNull: true },
    id_recepcion_compra: ref('recepciones_compra')
};
export const COLUMNAS_SOLICITUD_PRODUCCION: Record<string, ModelAttributeColumnOptions> = {
    clave_creacion: { type: DataTypes.STRING(80), allowNull: true }, hash_creacion: { type: DataTypes.STRING(64), allowNull: true }
};
