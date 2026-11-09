import { QueryTypes, Transaction } from 'sequelize';
import sequelize from '../db/connection';

const VERSION = '20261108-productor-proveedor-unico';
type Fila = Record<string, any>;
const leer = (sql: string, replacements: Record<string, any> = {}, transaction?: Transaction) =>
    sequelize.query<Fila>(sql, { replacements, type: QueryTypes.SELECT, transaction });
const nombre = (valor: string) => '`' + valor.replace(/`/g, '``') + '`';
const normalizar = (valor: unknown) => String(valor || '').trim().replace(/\s+/g, ' ').toLocaleUpperCase('es');

/** DDL en MySQL no es transaccional: el registro de avance permite reanudar sin remapear dos veces. */
export async function unificarProductoresProveedores() {
    await sequelize.query(`CREATE TABLE IF NOT EXISTS migraciones_proveedores (
        version VARCHAR(80) PRIMARY KEY, estado VARCHAR(30) NOT NULL,
        mapa LONGTEXT NOT NULL, actualizado_at DATETIME NOT NULL
    ) ENGINE=InnoDB`);
    const tablas = new Set((await sequelize.getQueryInterface().showAllTables()).map(String));
    const existeOrigen = tablas.has('productores');
    let [avance] = await leer('SELECT * FROM migraciones_proveedores WHERE version=:version', { version: VERSION });
    if (!existeOrigen && !avance) return { estado: 'sin_tabla_productores' };

    const referencias = [] as { tabla: string; columna: string }[];
    for (const tabla of ['compras', 'produccion_operaciones', 'produccion_lotes']) {
        if (!tablas.has(tabla)) continue;
        const columnas = await sequelize.getQueryInterface().describeTable(tabla);
        for (const columna of ['id_productor', 'id_propietario']) if (columnas[columna]) referencias.push({ tabla, columna });
    }
    const claves = await leer(`SELECT TABLE_NAME tabla,COLUMN_NAME columna,CONSTRAINT_NAME clave
        FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME='productores'`);
    for (const fk of claves) {
        if (!referencias.some(r => r.tabla === fk.tabla && r.columna === fk.columna))
            throw new Error(`Referencia no prevista: ${fk.tabla}.${fk.columna}. No se elimina la tabla.`);
    }

    if (!avance) {
        await sequelize.transaction(async transaction => {
            const proveedores = await leer('SELECT * FROM proveedores ORDER BY id', {}, transaction);
            const productores = await leer('SELECT * FROM productores ORDER BY id', {}, transaction);
            const mapa: Record<string, number> = {};
            for (const productor of productores) {
                // La antigua asociación id_proveedor NO prueba identidad: podía ser un intermediario.
                const documento = normalizar(productor.nit_ci);
                const coincidencias = proveedores.filter(p => documento
                    ? normalizar(p.nit_ci) === documento
                    : normalizar(p.nombre) === normalizar(productor.nombre) && !normalizar(p.nit_ci));
                if (coincidencias.length > 1) throw new Error(`Identidad ambigua para productor ${productor.id}.`);
                let proveedor = coincidencias[0];
                if (!proveedor) {
                    const datos: Fila = {};
                    for (const campo of ['nombre', 'nit_ci', 'telefono', 'direccion', 'observacion', 'activo', 'path_imagen', 'created_at', 'updated_at'])
                        datos[campo] = productor[campo] ?? (campo.endsWith('_at') ? new Date() : null);
                    datos.activo = productor.activo ?? true;
                    const campos = Object.keys(datos);
                    const [id] = await sequelize.query(`INSERT INTO proveedores (${campos.map(nombre).join(',')}) VALUES (${campos.map(c => ':' + c).join(',')})`, { replacements: datos, transaction });
                    proveedor = { ...datos, id: Number(id) };
                    proveedores.push(proveedor);
                } else {
                    const completar: Fila = {};
                    for (const campo of ['telefono', 'direccion', 'observacion', 'path_imagen'])
                        if (!proveedor[campo] && productor[campo]) completar[campo] = productor[campo];
                    if (Object.keys(completar).length) await sequelize.query(`UPDATE proveedores SET ${Object.keys(completar).map(c => nombre(c) + '=:' + c).join(',')} WHERE id=:id`, { replacements: { ...completar, id: proveedor.id }, transaction });
                }
                mapa[String(productor.id)] = Number(proveedor.id);
            }
            await sequelize.query('INSERT INTO migraciones_proveedores (version,estado,mapa,actualizado_at) VALUES (:version,:estado,:mapa,NOW())',
                { replacements: { version: VERSION, estado: 'PREPARADO', mapa: JSON.stringify(mapa) }, transaction });
        });
        [avance] = await leer('SELECT * FROM migraciones_proveedores WHERE version=:version', { version: VERSION });
    }

    for (const fk of claves) await sequelize.query(`ALTER TABLE ${nombre(fk.tabla)} DROP FOREIGN KEY ${nombre(fk.clave)}`);
    if (avance.estado === 'PREPARADO') {
        const mapa = JSON.parse(avance.mapa) as Record<string, number>;
        await sequelize.transaction(async transaction => {
            for (const ref of referencias) {
                const ids = await leer(`SELECT DISTINCT ${nombre(ref.columna)} id FROM ${nombre(ref.tabla)} WHERE ${nombre(ref.columna)} IS NOT NULL`, {}, transaction);
                if (ids.some(r => mapa[String(r.id)] === undefined)) throw new Error(`Referencia huérfana en ${ref.tabla}.${ref.columna}.`);
                const entries = Object.entries(mapa);
                if (!entries.length) continue;
                const params: Fila = {};
                const casos = entries.map(([id, destino], i) => { params['origen' + i] = Number(id); params['destino' + i] = destino; return `WHEN :origen${i} THEN :destino${i}`; });
                // Un solo CASE evita colisiones entre IDs originales y nuevos.
                await sequelize.query(`UPDATE ${nombre(ref.tabla)} SET ${nombre(ref.columna)}=CASE ${nombre(ref.columna)} ${casos.join(' ')} ELSE ${nombre(ref.columna)} END WHERE ${nombre(ref.columna)} IS NOT NULL`, { replacements: params, transaction });
            }
            if (tablas.has('compras')) await sequelize.query('UPDATE compras SET id_productor=id_proveedor', { transaction });
            await sequelize.query('UPDATE migraciones_proveedores SET estado=:estado,actualizado_at=NOW() WHERE version=:version', { replacements: { estado: 'DATOS_MIGRADOS', version: VERSION }, transaction });
        });
    }
    for (const ref of referencias) {
        const [huerfanos] = await leer(`SELECT COUNT(*) n FROM ${nombre(ref.tabla)} r LEFT JOIN proveedores p ON p.id=r.${nombre(ref.columna)} WHERE r.${nombre(ref.columna)} IS NOT NULL AND p.id IS NULL`);
        if (Number(huerfanos.n)) throw new Error(`Hay referencias sin proveedor en ${ref.tabla}.${ref.columna}.`);
        const fk = await leer(`SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=:tabla AND COLUMN_NAME=:columna AND REFERENCED_TABLE_NAME='proveedores'`, ref);
        if (!fk.length) await sequelize.query(`ALTER TABLE ${nombre(ref.tabla)} ADD CONSTRAINT ${nombre(ref.tabla + '_' + ref.columna + '_proveedor_fk')} FOREIGN KEY (${nombre(ref.columna)}) REFERENCES proveedores(id) ON UPDATE CASCADE ON DELETE RESTRICT`);
    }
    if (existeOrigen) await sequelize.query('DROP TABLE productores');
    await sequelize.query('UPDATE migraciones_proveedores SET estado=:estado,actualizado_at=NOW() WHERE version=:version', { replacements: { estado: 'COMPLETADO', version: VERSION } });
    return { estado: 'COMPLETADO', productoresIntegrados: Object.keys(JSON.parse(avance.mapa)).length, referencias: referencias.length };
}
