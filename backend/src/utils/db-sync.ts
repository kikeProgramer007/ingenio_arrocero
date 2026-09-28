const SCHEMAS_SISTEMA = new Set([
    'sys',
    'mysql',
    'information_schema',
    'performance_schema',
]);

/**
 * Criterio de evolución de esquema:
 * - Nunca force (no borra datos).
 * - En desarrollo: alter=true (agrega columnas nuevas al modelo), salvo DB_SYNC_ALTER=false.
 * - En producción: alter=false, salvo override explícito DB_SYNC_ALTER=true.
 */
export function shouldAlterSchema(): boolean {
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
        return process.env.DB_SYNC_ALTER === 'true';
    }
    return process.env.DB_SYNC_ALTER !== 'false';
}

export function assertBaseDeUsuario(nombre: string): void {
    const db = nombre.trim().toLowerCase();
    if (SCHEMAS_SISTEMA.has(db)) {
        throw new Error(
            `DB_NAME="${nombre}" es un schema de sistema y no admite CREATE TABLE. ` +
            'Usá una base de usuario (en TiDB Cloud existe "test", o creá "ingenio_arrocero" en el cluster).'
        );
    }
}
