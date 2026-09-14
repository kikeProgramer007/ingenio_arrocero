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
