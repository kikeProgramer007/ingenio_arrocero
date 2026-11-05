import { DataTypes, QueryTypes } from 'sequelize';
import sequelize from '../db/connection';
import { TABLAS_PRODUCCION } from '../db/produccion-schema';
import { PROGRAMAS_PRODUCCION, permisosInicialesProduccion, VERSION_PRODUCCION } from '../constants/produccion.constants';
import { Perfil, PerfilProgramas, Programas } from '../models';

export { VERSION_PRODUCCION };

/** Solo crea tablas nuevas. MySQL hace commit de DDL: una interrupción se reanuda al repetir. */
export async function up(): Promise<void> {
    const qi = sequelize.getQueryInterface();
    const existentes = new Set((await qi.showAllTables()).map(String));
    for (const tabla of TABLAS_PRODUCCION) {
        if (!existentes.has(tabla.nombre)) {
            await qi.createTable(tabla.nombre, tabla.columnas, { engine: 'InnoDB' });
        } else {
            const columnas = await qi.describeTable(tabla.nombre);
            const faltantes = Object.keys(tabla.columnas).filter(c => !columnas[c]);
            if (faltantes.length) throw new Error(`Esquema incompleto en ${tabla.nombre}: ${faltantes.join(', ')}. No se alteró la tabla.`);
        }
        const indices = await qi.showIndex(tabla.nombre) as { name: string }[];
        for (const campos of tabla.indices || []) {
            const nombre = `${tabla.nombre}_${campos.join('_')}`.slice(0, 64);
            if (!indices.some(i => i.name === nombre)) {
                await qi.addIndex(tabla.nombre, campos, {
                    name: nombre,
                    unique: tabla.nombre === 'produccion_operacion_lotes' && campos.length === 3
                });
            }
        }
    }
    if (!existentes.has('produccion_migraciones')) {
        await qi.createTable('produccion_migraciones', {
            version: { type: DataTypes.STRING(80), primaryKey: true, allowNull: false },
            aplicada_at: { type: DataTypes.DATE, allowNull: false }
        });
    }
    // No llama al seed general: no elimina programas ni toca registros comerciales.
    await sequelize.transaction(async transaction => {
        let idPadre: unknown = null;
        for (const programa of PROGRAMAS_PRODUCCION) {
            const [registro] = await Programas.findOrCreate({
                where: { url: programa.url }, defaults: { ...programa, id_padre: idPadre, eliminado: false }, transaction
            });
            await registro.update({ id_padre: idPadre, eliminado: false }, { transaction });
            if (programa.url === '/produccion') idPadre = registro.get('id');
            for (const perfil of await Perfil.findAll({ where: { eliminado: false }, transaction })) {
                await PerfilProgramas.findOrCreate({
                    where: { id_perfil: perfil.get('id'), id_programa: registro.get('id') },
                    defaults: { id_perfil: perfil.get('id'), id_programa: registro.get('id'), ...permisosInicialesProduccion(perfil.get('nombre')) },
                    transaction
                });
            }
        }
        await sequelize.query('INSERT IGNORE INTO produccion_migraciones (version, aplicada_at) VALUES (:version, NOW())', {
            replacements: { version: VERSION_PRODUCCION }, type: QueryTypes.INSERT, transaction
        });
    });
}
