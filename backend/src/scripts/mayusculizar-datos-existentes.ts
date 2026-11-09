/**
 * Pasa a mayúsculas los textos ya guardados en la BD.
 * Respeta las mismas exclusiones que el middleware (username, email, password, paths, tokens, JSON).
 *
 * Uso:
 *   npm run mayusculas:datos -- --base=db_empresa_rojas
 *   npm run mayusculas:datos -- --base=db_empresa_rojas --dry-run
 */
import { QueryTypes } from 'sequelize';
import sequelize from '../db/connection';
import { assertBaseDeUsuario } from '../utils/db-sync';
import { columnaExentaDeMayusculas } from '../utils/mayusculas';

type Columna = { Field: string; Type: string; Key: string };
type Contador = { tabla: string; columna: string; afectados: number };

const TIPOS_TEXTO = /^(char|varchar|tinytext|text|mediumtext|longtext)\b/i;
const TABLAS_OMITIR = new Set([
    'migraciones_proveedores',
    'produccion_migraciones',
    'programas',
    'perfil_programas',
    'sequelizemeta',
    'SequelizeMeta'
]);

function esTextoPersistible(tipo: string): boolean {
    return TIPOS_TEXTO.test(String(tipo || '').trim());
}

async function mayusculizarTabla(tabla: string, dryRun: boolean): Promise<Contador[]> {
    const columnas = await sequelize.query<Columna>(`SHOW COLUMNS FROM \`${tabla.replace(/`/g, '``')}\``, {
        type: QueryTypes.SELECT
    });
    const texto = columnas.filter((c) => esTextoPersistible(c.Type) && !columnaExentaDeMayusculas(c.Field));
    const resultados: Contador[] = [];

    for (const col of texto) {
        const t = tabla.replace(/`/g, '``');
        const c = col.Field.replace(/`/g, '``');
        const [{ n }] = await sequelize.query<{ n: number }>(
            `SELECT COUNT(*) AS n FROM \`${t}\`
             WHERE \`${c}\` IS NOT NULL AND \`${c}\` <> ''
               AND BINARY \`${c}\` <> BINARY UPPER(\`${c}\`)
               AND \`${c}\` NOT LIKE '{%'
               AND \`${c}\` NOT LIKE '[%'
               AND \`${c}\` NOT LIKE '/uploads/%'
               AND \`${c}\` NOT LIKE 'uploads/%'`,
            { type: QueryTypes.SELECT }
        );
        const afectados = Number(n) || 0;
        if (!afectados) continue;
        if (!dryRun) {
            await sequelize.query(
                `UPDATE \`${t}\` SET \`${c}\` = UPPER(\`${c}\`)
                 WHERE \`${c}\` IS NOT NULL AND \`${c}\` <> ''
                   AND BINARY \`${c}\` <> BINARY UPPER(\`${c}\`)
                   AND \`${c}\` NOT LIKE '{%'
                   AND \`${c}\` NOT LIKE '[%'
                   AND \`${c}\` NOT LIKE '/uploads/%'
                   AND \`${c}\` NOT LIKE 'uploads/%'`
            );
        }
        resultados.push({ tabla, columna: col.Field, afectados });
    }
    return resultados;
}

async function main() {
    const dryRun = process.argv.includes('--dry-run');
    const esperado = process.argv.find((a) => a.startsWith('--base='))?.slice(7);
    const base = sequelize.getDatabaseName();
    assertBaseDeUsuario(base);
    if (!esperado || esperado !== base) {
        throw new Error(`Esta ejecución requiere --base=${base} (y la misma base en .env).`);
    }

    await sequelize.authenticate();
    const tablas = (await sequelize.getQueryInterface().showAllTables()).map(String)
        .filter((t) => !TABLAS_OMITIR.has(t));

    const detalle: Contador[] = [];
    for (const tabla of tablas) {
        detalle.push(...await mayusculizarTabla(tabla, dryRun));
    }

    const totalFilasColumna = detalle.reduce((s, d) => s + d.afectados, 0);
    console.log(JSON.stringify({
        base,
        modo: dryRun ? 'dry-run' : 'aplicado',
        tablasRevisadas: tablas.length,
        columnasModificadas: detalle.length,
        celdasAfectadas: totalFilasColumna,
        detalle
    }, null, 2));
}

main()
    .catch((error) => {
        console.error((error as Error).message);
        process.exitCode = 1;
    })
    .finally(() => sequelize.close());
