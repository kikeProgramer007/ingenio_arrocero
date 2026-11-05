import '../load-env';
import assert from 'assert/strict';
import { QueryTypes } from 'sequelize';
import { Request, Response } from 'express';
import { sequelize, User } from '../models';
import { TABLAS_PRODUCCION } from '../db/produccion-schema';
import { permisoProduccion } from '../controllers/produccion-base.controller';
import { filtrosProduccion, lotesProduccion, operacionesProduccion, resumenProduccion } from '../servicios/produccion-consulta.servicio';

/** Comprobación de lectura: no crea usuarios, lotes ni operaciones de muestra. */
async function main() {
    await sequelize.authenticate();
    const tablas = new Set((await sequelize.getQueryInterface().showAllTables()).map(String));
    assert(TABLAS_PRODUCCION.every(t => tablas.has(t.nombre)), 'Faltan tablas de Producción.');
    const usuario = await User.findOne({ where: { activo: true, eliminado: false }, order: [['id', 'ASC']] });
    assert(usuario, 'No hay usuario activo para comprobar permisos.');
    const salidas: Record<string, number> = {};
    for (const [pagina, tipo] of [['resumen', undefined], ['descarguios', 'DESCARGUIO'], ['secados', 'SECADO'],
        ['guardados', 'GUARDADO'], ['procesados', 'PROCESADO'], ['envasados', 'ENVASADO'], ['lotes', undefined]]) {
        let permitido = false;
        let estado = 200;
        const respuesta = { status: (codigo: number) => { estado = codigo; return respuesta; }, json: () => respuesta };
        await permisoProduccion({ path: pagina === 'lotes' ? '/lotes' : tipo ? '/operaciones' : '/resumen',
            query: tipo ? { tipo } : {}, user: { id: usuario.get('id') } } as unknown as Request,
            respuesta as unknown as Response, () => { permitido = true; });
        assert(permitido, `Acceso a ${pagina}: HTTP ${estado}. El usuario elegido debe tener permiso de lectura.`);
        const f = filtrosProduccion(tipo ? { tipo } : {});
        const listado = pagina === 'lotes' ? await lotesProduccion(f) : await operacionesProduccion(f);
        assert(Array.isArray(listado.items) && listado.items.length <= 10 && listado.total >= listado.items.length);
        salidas[pagina!] = listado.total;
    }
    for (const modalidad of ['COMPRA', 'SERVICIO']) {
        const resumen = await resumenProduccion(filtrosProduccion({ modalidad, fecha_desde: '2026-01-01', fecha_hasta: '2026-12-31' }));
        assert(Object.values(resumen.indicadores).every(n => Number.isFinite(n) && n >= 0));
        assert(resumen.chala.every(s => s.modalidad === modalidad));
    }
    for (const consulta of [{ fecha_desde: '2026-02-31' }, { modalidad: 'OTRA' }, { offset: -1 }, { tipo: 'OTRO' }, { fecha_desde: '2026-12-31', fecha_hasta: '2026-01-01' }]) {
        assert.throws(() => filtrosProduccion(consulta));
    }
    let denegado = 0;
    const rechazo = { status: (codigo: number) => { denegado = codigo; return rechazo; }, json: () => rechazo };
    await permisoProduccion({ path: '/resumen', query: {}, user: { id: -1 } } as unknown as Request, rechazo as unknown as Response,
        () => { throw new Error('Se permitió un usuario inexistente.'); });
    assert.equal(denegado, 403);
    const filas = await sequelize.query('SELECT COUNT(*) total FROM produccion_movimientos', { type: QueryTypes.SELECT }) as { total: number }[];
    console.log(JSON.stringify({ base: sequelize.getDatabaseName(), consultas: salidas, filtros: 'válidos', usuarioInexistente: 403, movimientosProduccion: Number(filas[0]!.total), escriturasDePrueba: 0 }));
}
main().catch(error => { console.error((error as Error).message); process.exitCode = 1; }).finally(() => sequelize.close());
