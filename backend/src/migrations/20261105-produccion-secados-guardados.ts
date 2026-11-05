import { DataTypes, QueryTypes } from 'sequelize';
import sequelize from '../db/connection';
import { VERSION_DESCARGUIOS } from '../db/descarguio-schema';

export const VERSION_ETAPAS = '20261105-produccion-secados-guardados';
export async function up() {
    const qi = sequelize.getQueryInterface();
    const base = await sequelize.query('SELECT version FROM produccion_migraciones WHERE version = :version', { replacements: { version: VERSION_DESCARGUIOS }, type: QueryTypes.SELECT });
    if (!base.length) throw new Error('Ejecute primero migrate:descarguios.');
    const tables = (await qi.showAllTables()).map(String);
    const ref = (model: string, nullable = false): any => ({ type: DataTypes.INTEGER, allowNull: nullable, references: { model, key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
    if (!tables.includes('produccion_etapa_origenes')) {
        await qi.createTable('produccion_etapa_origenes', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
            id_operacion: ref('produccion_operaciones'), id_lote: ref('produccion_lotes'),
            cantidad: { type: DataTypes.DECIMAL(18,3).UNSIGNED, allowNull: true },
            id_lote_resultado: ref('produccion_lotes', true)
        });
        await qi.addIndex('produccion_etapa_origenes', ['id_operacion','id_lote'], { unique: true, name: 'produccion_etapa_origen_unico' });
        await qi.addIndex('produccion_etapa_origenes', ['id_lote']);
    }
    for (const tabla of ['produccion_secados','produccion_guardados']) {
        const columns = await qi.describeTable(tabla);
        const additions: Record<string, any> = { destino_nombre: { type: DataTypes.STRING(150), allowNull: true } };
        if (tabla === 'produccion_secados') {
            additions.id_ubicacion = ref('produccion_ubicaciones', true);
            additions.ubicacion_detalle = { type: DataTypes.STRING(200), allowNull: true };
        } else additions.condicion = { type: DataTypes.STRING(150), allowNull: true };
        for (const [column, definition] of Object.entries(additions)) if (!columns[column]) await qi.addColumn(tabla, column, definition);
        if (tabla === 'produccion_guardados' && !columns.id_ubicacion.allowNull)
            await qi.changeColumn(tabla, 'id_ubicacion', { type: DataTypes.INTEGER, allowNull: true });
    }
    await sequelize.query('INSERT IGNORE INTO produccion_migraciones (version,aplicada_at) VALUES (:version,NOW())', { replacements: { version: VERSION_ETAPAS } });
}
