import { QueryTypes } from 'sequelize';
import { sequelize } from '../models';

type ColumnRow = { Field: string; Null: string };

export async function asegurarEsquemaGastos(): Promise<void> {
    const columnas = await sequelize.query<ColumnRow>('SHOW COLUMNS FROM gastos', {
        type: QueryTypes.SELECT
    });
    const porNombre = new Map(columnas.map((col) => [col.Field, col]));

    if (!porNombre.has('descontar_caja')) {
        await sequelize.query(
            'ALTER TABLE gastos ADD COLUMN descontar_caja TINYINT(1) NOT NULL DEFAULT 1'
        );
    }

    const idCaja = porNombre.get('id_caja');
    if (idCaja && String(idCaja.Null).toUpperCase() === 'NO') {
        await sequelize.query('ALTER TABLE gastos MODIFY COLUMN id_caja INT NULL');
    }
}
