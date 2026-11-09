const db = require('../dist/db/connection').default;
const { QueryTypes } = require('sequelize');
(async () => {
    await db.authenticate();
    const tables = (await db.getQueryInterface().showAllTables()).map(String);
    console.log('DATABASE', db.getDatabaseName());
    console.log(JSON.stringify({
        productores: tables.includes('productores'),
        proveedores: Number((await db.query('SELECT COUNT(*) n FROM proveedores', { type: QueryTypes.SELECT }))[0].n),
        fksProductores: await db.query(
            "SELECT TABLE_NAME,COLUMN_NAME,CONSTRAINT_NAME,REFERENCED_TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME='productores'",
            { type: QueryTypes.SELECT }
        ),
        fksProveedorCols: await db.query(
            "SELECT TABLE_NAME,COLUMN_NAME,CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME='proveedores' AND COLUMN_NAME IN ('id_productor','id_propietario')",
            { type: QueryTypes.SELECT }
        ),
        avance: tables.includes('migraciones_proveedores')
            ? await db.query('SELECT version,estado,actualizado_at FROM migraciones_proveedores', { type: QueryTypes.SELECT })
            : []
    }, null, 2));
})().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => db.close());
