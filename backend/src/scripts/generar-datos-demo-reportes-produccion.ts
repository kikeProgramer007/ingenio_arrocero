import '../load-env';
import {randomUUID} from 'crypto';
import {sequelize, Proveedor, User} from '../models';
import {Transaction, QueryTypes} from 'sequelize';
import {crearDescarguio, confirmarDescarguio} from '../servicios/descarguios.servicio';
import {guardarEtapa, confirmarEtapa} from '../servicios/produccion-etapas.servicio';

const marca = 'PRUEBA-REPORTES-ROJAS-202611';
const iso = (date: string, time: string) => `${date}T${time}:00.000Z`;
const key = () => randomUUID();

async function eliminarDemo(transaction: Transaction) {
    const ops = await sequelize.query<{ id: number }>(
        `SELECT DISTINCT o.id FROM produccion_operaciones o
         LEFT JOIN proveedores p ON p.id = o.id_productor OR p.id = o.id_propietario
         LEFT JOIN produccion_descarguios d ON d.id_operacion = o.id
         WHERE p.nombre = :productor OR d.boleta LIKE :boleta`,
        { replacements: { productor: `PRODUCTOR ${marca}`, boleta: `${marca}%` }, type: QueryTypes.SELECT, transaction }
    );
    const ids = ops.map(x => Number(x.id));
    if (!ids.length) return;
    const idsSql = ids.join(',');
    const lotRows = await sequelize.query<{ id: number }>(
        `SELECT id FROM produccion_lotes WHERE id_operacion_origen IN (${idsSql})`,
        { type: QueryTypes.SELECT, transaction }
    );
    const lotIds = lotRows.map(x => Number(x.id));
    const lotSql = lotIds.length ? lotIds.join(',') : '0';

    // Borrar hijos del lote antes de operaciones; restringido a registros vinculados a la marca demo.
    for (const table of ['produccion_envasados', 'produccion_procesado_detalles', 'produccion_etapa_origenes', 'produccion_operacion_lotes', 'produccion_inventario_vinculos']) {
        await sequelize.query(`DELETE FROM ${table} WHERE id_operacion IN (${idsSql})`, { transaction });
    }
    await sequelize.query(`UPDATE produccion_movimientos SET id_movimiento_revertido = NULL WHERE id_operacion IN (${idsSql})`, { transaction });
    await sequelize.query(`DELETE FROM produccion_movimientos WHERE id_operacion IN (${idsSql})`, { transaction });
    for (const table of ['produccion_descarguios', 'produccion_secados', 'produccion_guardados', 'produccion_procesados']) {
        await sequelize.query(`DELETE FROM ${table} WHERE id_operacion IN (${idsSql})`, { transaction });
    }
    if (lotIds.length) {
        await sequelize.query(`DELETE FROM produccion_procesado_detalles WHERE id_lote_resultado IN (${lotSql})`, { transaction });
        await sequelize.query(`DELETE FROM produccion_auditoria WHERE id_lote IN (${lotSql})`, { transaction });
        await sequelize.query(`DELETE FROM produccion_lotes WHERE id IN (${lotSql})`, { transaction });
    }
    await sequelize.query(`DELETE FROM produccion_auditoria WHERE id_operacion IN (${idsSql})`, { transaction });
    await sequelize.query(`DELETE FROM produccion_operaciones WHERE id IN (${idsSql})`, { transaction });
}

async function borrarMaestrosDemo(transaction: Transaction) {
    const products = await sequelize.query<{ id: number; stock: string }>(
        `SELECT id, stock FROM productos WHERE nombre LIKE :suffix`,
        { replacements: { suffix: `%${marca}` }, type: QueryTypes.SELECT, transaction }
    );
    for (const p of products) {
        if (Number(p.stock) !== 0) throw new Error(`No se elimina producto demo ${p.id}: tiene stock ${p.stock}.`);
        const refs = await sequelize.query<{ n: number }>(
            `SELECT
             (SELECT COUNT(*) FROM compra_detalles WHERE id_producto=:id) +
             (SELECT COUNT(*) FROM venta_detalles WHERE id_producto=:id) +
             (SELECT COUNT(*) FROM reservas_venta WHERE id_producto=:id) +
             (SELECT COUNT(*) FROM reservas_producto WHERE id_producto=:id) +
             (SELECT COUNT(*) FROM movimientos_inventario WHERE id_producto=:id) +
             (SELECT COUNT(*) FROM acopios WHERE id_producto=:id) +
             (SELECT COUNT(*) FROM producciones WHERE id_producto_origen=:id OR id_producto_destino=:id) +
             (SELECT COUNT(*) FROM produccion_procesado_detalles WHERE id_producto=:id) +
             (SELECT COUNT(*) FROM produccion_envasados WHERE id_producto_empaque=:id OR id_producto_destino=:id) AS n`,
            { replacements: { id: p.id }, type: QueryTypes.SELECT, transaction }
        );
        if (Number(refs[0].n) !== 0) throw new Error(`No se elimina producto demo ${p.id}: conserva referencias.`);
        await sequelize.query(`DELETE FROM productos WHERE id=:id AND nombre LIKE :suffix`, { replacements: { id: p.id, suffix: `%${marca}` }, transaction });
    }
    const producer = await Proveedor.findOne({ where: { nombre: `PRODUCTOR ${marca}` }, transaction, lock: transaction.LOCK.UPDATE });
    if (producer) {
        const id = Number(producer.get('id'));
        const [refs] = await sequelize.query<{ n: number }>(
            `SELECT (SELECT COUNT(*) FROM compras WHERE id_productor=:id) +
             (SELECT COUNT(*) FROM produccion_operaciones WHERE id_productor=:id OR id_propietario=:id) +
             (SELECT COUNT(*) FROM produccion_lotes WHERE id_productor=:id OR id_propietario=:id) AS n`,
            { replacements: { id }, type: QueryTypes.SELECT, transaction }
        );
        if (Number(refs.n)) throw new Error(`No se elimina productor demo ${id}: conserva referencias.`);
        await producer.destroy({ transaction });
    }
    await sequelize.query(`DELETE FROM produccion_ubicaciones WHERE nombre='ALMACÉN DE PRUEBA ROJAS' AND id=13`, { transaction });
}

async function main() {
    await sequelize.authenticate();
    if (process.env.NODE_ENV !== 'development' || sequelize.getDatabaseName() !== 'db_empresa_rojas') {
        throw new Error(`Cancelado: se requiere desarrollo/db_empresa_rojas; actual=${process.env.NODE_ENV}/${sequelize.getDatabaseName()}.`);
    }
    const transaction = await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED });
    try {
        await eliminarDemo(transaction);
        await borrarMaestrosDemo(transaction);
        const usuario = await User.findOne({ where: { activo: true, eliminado: false }, transaction });
        if (!usuario) throw new Error('No existe un usuario activo para registrar los datos simulados.');
        const idUsuario = Number(usuario.get('id'));
        let productor = await Proveedor.findOne({ where: sequelize.where(sequelize.fn('LOWER', sequelize.col('nombre')), 'ruben orellana'), transaction });
        if (!productor) productor = await Proveedor.create({ nombre: 'RUBEN ORELLANA', activo: true }, { transaction });
        const idProductor = Number(productor.get('id'));
        const fechaD = iso('2026-02-20', '16:00'); // 12:00 hora local de Bolivia
        const descarguioDraft = await crearDescarguio({
            fecha: fechaD, modalidad: 'SERVICIO', id_productor: idProductor, id_producto: 1,
            boleta: 'P-414843', variedad: 'MAC-18', cantidad: 217.6, unidad: 'Fanega',
            chofer: 'LUCIANO VILLANUEVA', placa: '1571-BC', procedencia: 'San Pablo', localidad: 'San Pablo',
            punto_descarga: 'C1', humedad_entrada: 18.5, impurezas_entrada: 4.4, impurezas_salida: 3.8,
            clave_creacion: key()
        }, idUsuario, transaction);
        const descarguio = await confirmarDescarguio(descarguioDraft.id, { version: descarguioDraft.version, clave_confirmacion: key() }, idUsuario, transaction);
        const secadoDraft = await guardarEtapa('SECADO', null, {
            fecha: iso('2026-02-21', '16:00'), origenes: [{ id_lote: descarguio.id_lote, cantidad: 217.6 }],
            secadora: 'COMIL', silo: 'C1', operador: 'ERNESTO', responsable: 'ERNESTO',
            inicio: iso('2026-02-21', '15:05'), fin: iso('2026-02-21', '20:32'),
            humedad_entrada: 18.5, humedad_salida: 11.3, clave_creacion: key()
        }, idUsuario, transaction);
        const secado = await confirmarEtapa('SECADO', secadoDraft.id, { version: secadoDraft.version, clave_confirmacion: key() }, idUsuario, transaction);
        const guardadoDraft = await guardarEtapa('GUARDADO', null, {
            fecha: iso('2026-02-24', '16:00'), origenes: [{ id_lote: secado.origenes[0].id_lote_resultado, cantidad: 217.6 }],
            destino_nombre: 'N-1/1/6', ubicacion_detalle: 'N-1/1/6', responsable: 'ERNESTO', clave_creacion: key()
        }, idUsuario, transaction);
        const guardado = await confirmarEtapa('GUARDADO', guardadoDraft.id, { version: guardadoDraft.version, clave_confirmacion: key() }, idUsuario, transaction);
        await transaction.commit();
        console.log(JSON.stringify({ resultado: 'reemplazado', entorno: process.env.NODE_ENV, base: sequelize.getDatabaseName(),
            fuente: 'Transcripción simulada de las planillas del cliente; no es movimiento operativo real.',
            registros: { descarguio: descarguio.codigo, secado: secado.codigo, guardado: guardado.codigo },
            vinculo: 'Boleta P-414843 · Rubén Orellana · MAC-18', cantidad: '217,60 fanegas',
            procesado: 'omitido: el formato aportado corresponde a otra cadena y no permite vincularlo con seguridad.' }));
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => sequelize.close());
