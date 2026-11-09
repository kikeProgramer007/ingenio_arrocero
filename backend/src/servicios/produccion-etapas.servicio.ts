import { createHash } from 'crypto';
import { QueryTypes, Transaction } from 'sequelize';
import sequelize from '../db/connection';
import { claveSolicitud, ErrorDescarguio, versionDescarguio } from '../dtos/descarguio.dto';
import { Etapa, FilaEtapa as Fila, validarEtapa } from '../dtos/produccion-etapa.dto';
import { leerDesc } from './descarguios.servicio';
import { Productos, ReservaProducto } from '../models';
import { normalizarUnidadMedida } from '../utils/unidad-medida';
import { mayusculizarDatos } from '../utils/mayusculas';

const tabla = (tipo: Etapa) => tipo === 'SECADO' ? 'produccion_secados' : 'produccion_guardados';
const previa = (tipo: Etapa) => tipo === 'SECADO' ? 'DESCARGUIO' : 'SECADO';
const mil = (v: unknown) => Math.round(Number(v || 0) * 1000);
/** Día calendario en Bolivia (YYYY-MM-DD) para comparar fechas de operación sin hora. */
function diaLaPaz(v: unknown): string {
    const d = v instanceof Date ? v : new Date(String(v || ''));
    if (!Number.isFinite(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
async function sql(query: string, replacements: Fila, transaction: Transaction) { return sequelize.query(query, { replacements: mayusculizarDatos(replacements), transaction }); }
async function insert(table: string, data: Fila, transaction: Transaction) {
    const payload = mayusculizarDatos(data);
    const keys = Object.keys(payload);
    const [id] = await sequelize.query(`INSERT INTO ${table} (${keys.map(k => '`'+k+'`').join(',')}) VALUES (${keys.map(k => ':'+k).join(',')})`, { replacements: payload, transaction, type: QueryTypes.INSERT });
    return Number(id);
}
const tx = <T>(work: (t: Transaction) => Promise<T>, external?: Transaction) => external ? work(external) : sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, work);
function idValido(v: unknown) {
    if (!Number.isSafeInteger(Number(v)) || Number(v) <= 0) throw new ErrorDescarguio('Identificador inválido.');
    return Number(v);
}
function version(o: Fila, raw: Fila) { if (Number(o.version) !== versionDescarguio(raw.version)) throw new ErrorDescarguio('El registro cambió. Vuelva a abrirlo antes de guardar.',409); }
async function audit(id: number, evento: string, antes: unknown, despues: unknown, usuario: number, t: Transaction, motivo: string | null = null) {
    await insert('produccion_auditoria', { id_operacion: id, evento, antes: antes == null ? null : JSON.stringify(antes), despues: despues == null ? null : JSON.stringify(despues), motivo, fecha: new Date(), id_usuario: usuario },t);
}
async function lock(tipo: Etapa, id: unknown, t: Transaction) {
    const [o] = await leerDesc('SELECT * FROM produccion_operaciones WHERE id = :id AND tipo = :tipo FOR UPDATE',{id:idValido(id),tipo},t);
    if (!o) throw new ErrorDescarguio('No se encontró el documento.',404);
    return o;
}
export async function obtenerEtapa(tipo: Etapa, id: unknown, t?: Transaction): Promise<Fila> {
    const [o] = await leerDesc(`SELECT o.*,d.*,p.nombre productor,u.nombre ubicacion FROM produccion_operaciones o JOIN ${tabla(tipo)} d ON d.id_operacion=o.id
        LEFT JOIN proveedores p ON p.id=o.id_productor LEFT JOIN produccion_ubicaciones u ON u.id=d.id_ubicacion WHERE o.id = :id AND o.tipo = :tipo`,{id:idValido(id),tipo},t);
    if (!o) throw new ErrorDescarguio('No se encontró el documento.',404);
    const origenes = await leerDesc(`SELECT r.*,l.codigo,l.unidad,l.variedad,l.cantidad_disponible,l.modalidad,l.id_propietario,l.id_productor,l.id_producto,
        p.nombre productor,pr.nombre producto,oo.codigo origen_codigo,oo.fecha origen_fecha,lr.codigo resultado_codigo,lr.cantidad_disponible disponible_resultado,
        COALESCE(s.humedad_salida,d.humedad_entrada) humedad_origen
        FROM produccion_etapa_origenes r JOIN produccion_lotes l ON l.id=r.id_lote JOIN produccion_operaciones oo ON oo.id=l.id_operacion_origen
        LEFT JOIN proveedores p ON p.id=l.id_productor LEFT JOIN productos pr ON pr.id=l.id_producto
        LEFT JOIN produccion_secados s ON s.id_operacion=oo.id LEFT JOIN produccion_descarguios d ON d.id_operacion=oo.id
        LEFT JOIN produccion_lotes lr ON lr.id=r.id_lote_resultado WHERE r.id_operacion = :id ORDER BY r.id`,{id:o.id},t);
    const historial = await leerDesc(`SELECT a.evento,a.fecha,a.motivo,COALESCE(NULLIF(u.nombre,''),u.username) usuario FROM produccion_auditoria a
        LEFT JOIN user u ON u.id=a.id_usuario WHERE a.id_operacion = :id ORDER BY a.id`,{id:o.id},t);
    return {...o,origenes,historial};
}
async function fuentes(tipo: Etapa, d: Fila, t: Transaction, confirmar = false): Promise<Fila[]> {
    const ids = d.origenes.map((o: Fila) => o.id_lote).sort((a:number,b:number)=>a-b);
    if (!ids.length) return [];
    // Se bloquea primero la operación de origen: serializa confirmación, edición de referencias y anulación.
    const refs = await leerDesc('SELECT DISTINCT id_operacion_origen id FROM produccion_lotes WHERE id IN (:ids) ORDER BY id_operacion_origen',{ids},t);
    for (const r of refs) await leerDesc('SELECT id FROM produccion_operaciones WHERE id = :id FOR UPDATE',{id:r.id},t);
    const lots = await leerDesc(`SELECT l.*,o.estado estado_origen,o.fecha fecha_origen,o.id_campana FROM produccion_lotes l JOIN produccion_operaciones o ON o.id=l.id_operacion_origen
        WHERE l.id IN (:ids) ORDER BY l.id FOR UPDATE`,{ids},t);
    if (lots.length !== ids.length) throw new ErrorDescarguio('Un lote de origen no existe.',409);
    const first = lots[0];
    for (const l of lots) {
        if (l.etapa !== previa(tipo) || l.estado_origen !== 'CONFIRMADO' || l.estado === 'ANULADO' || (confirmar && (l.estado !== 'ACTIVO' || mil(l.cantidad_disponible) <= 0)))
            throw new ErrorDescarguio(`El lote ${l.codigo} no está disponible en la etapa de origen.`,409);
        if (['modalidad','id_propietario','id_productor','id_producto','unidad','variedad'].some(k => String(l[k] ?? '') !== String(first[k] ?? '')))
            throw new ErrorDescarguio('Los lotes deben tener el mismo propietario, productor, producto, variedad y unidad. Registre operaciones separadas.',400,{origenes:'No se permite mezclar estas existencias.'});
        // Comparar solo el día (America/La_Paz): la fecha de secado es fecha de operación, no hora.
        if (diaLaPaz(d.fecha) < diaLaPaz(l.fecha_origen)) throw new ErrorDescarguio('La fecha no puede ser anterior a la operación de origen.',400,{fecha:'Revise la fecha del origen.'});
        if (tipo === 'SECADO' && d.inicio && d.inicio < l.fecha_origen) throw new ErrorDescarguio('El inicio no puede ser anterior a la recepción.',400,{inicio:'Revise la fecha y hora de recepción.'});
        const r = d.origenes.find((o: Fila)=>o.id_lote === Number(l.id));
        if (confirmar && mil(r.cantidad) > mil(l.cantidad_disponible)) throw new ErrorDescarguio(`La cantidad supera el disponible de ${l.codigo}: ${l.cantidad_disponible} ${l.unidad}.`,409,{origenes:'Actualice los disponibles y ajuste la cantidad.'});
    }
    return lots;
}
async function detalle(tipo: Etapa, id: number, d: Fila, t: Transaction, nuevo = false) {
    const fields = tipo === 'SECADO' ? ['proc','secadora','silo','operador','inicio','fin','humedad_entrada','humedad_salida','peso_salida','unidad_peso_salida','merma_medida','unidad_merma','justificacion_merma'] : ['condicion','orden_guardado'];
    fields.push('id_ubicacion','destino_nombre','ubicacion_detalle');
    const values = Object.fromEntries(fields.map(k=>[k,d[k]]));
    if (nuevo) await insert(tabla(tipo),{id_operacion:id,...values},t);
    else await sql(`UPDATE ${tabla(tipo)} SET ${fields.map(k=>'`'+k+'` = :'+k).join(',')} WHERE id_operacion = :id`,{...values,id},t);
    // Solo las líneas del borrador se reemplazan; nunca se eliminan movimientos ni historia.
    await sql('DELETE FROM produccion_etapa_origenes WHERE id_operacion = :id',{id},t);
    await sql("DELETE FROM produccion_operacion_lotes WHERE id_operacion = :id AND rol='ENTRADA'",{id},t);
    for (const r of d.origenes) {
        await insert('produccion_etapa_origenes',{id_operacion:id,id_lote:r.id_lote,cantidad:r.cantidad},t);
        const [l] = await leerDesc('SELECT unidad FROM produccion_lotes WHERE id = :id',{id:r.id_lote},t);
        // La referencia también permite al descarguío detectar borradores dependientes.
        if (r.cantidad != null) await insert('produccion_operacion_lotes',{id_operacion:id,id_lote:r.id_lote,rol:'ENTRADA',cantidad:r.cantidad,unidad:l.unidad},t);
    }
}
async function destinoValido(d: Fila, t: Transaction) {
    if (d.id_ubicacion) {
        const [u] = await leerDesc('SELECT id FROM produccion_ubicaciones WHERE id = :id AND activo=1',{id:d.id_ubicacion},t);
        if (!u) throw new ErrorDescarguio('La ubicación no está activa.',400,{destino_nombre:'Seleccione una ubicación activa.'});
    }
}
export async function guardarEtapa(tipo: Etapa, id: unknown | null, raw: Fila, usuario: number, externa?: Transaction) {
    const d = validarEtapa(tipo,raw), key = id == null ? claveSolicitud(raw.clave_creacion) : null;
    const hash = createHash('sha256').update(JSON.stringify({tipo,...d})).digest('hex');
    return tx(async t => {
        let actual: Fila | null = null;
        const gestion = Number(new Intl.DateTimeFormat('en',{timeZone:'America/La_Paz',year:'numeric'}).format(d.fecha));
        if (id == null) {
            await sql('INSERT INTO produccion_secuencias (tipo,gestion,ultimo) VALUES (:tipo,:gestion,0) ON DUPLICATE KEY UPDATE ultimo=ultimo',{tipo,gestion},t);
            await leerDesc('SELECT ultimo FROM produccion_secuencias WHERE tipo = :tipo AND gestion = :gestion FOR UPDATE',{tipo,gestion},t);
            const [existing] = await leerDesc('SELECT id,hash_creacion FROM produccion_operaciones WHERE clave_creacion = :key',{key},t);
            if (existing) { if (existing.hash_creacion !== hash) throw new ErrorDescarguio('Esta solicitud ya fue guardada con otros datos.',409); return obtenerEtapa(tipo,existing.id,t); }
        } else {
            actual = await lock(tipo,id,t); version(actual,raw);
            if (actual.estado !== 'BORRADOR') throw new ErrorDescarguio('Solo se pueden editar borradores.',409);
        }
        const lots = await fuentes(tipo,d,t); await destinoValido(d,t);
        const first = lots[0];
        const header = {fecha:d.fecha,modalidad:first?.modalidad || 'SERVICIO',id_propietario:first?.id_propietario ?? null,id_productor:first?.id_productor ?? null,id_campana:first?.id_campana ?? null,responsable:d.responsable,observacion:d.observacion};
        let opId: number;
        if (!actual) {
            const [seq] = await leerDesc('SELECT ultimo FROM produccion_secuencias WHERE tipo = :tipo AND gestion = :gestion',{tipo,gestion},t);
            const n = Number(seq.ultimo)+1;
            await sql('UPDATE produccion_secuencias SET ultimo = :n WHERE tipo = :tipo AND gestion = :gestion',{tipo,gestion,n},t);
            opId = await insert('produccion_operaciones',{...header,codigo:`${tipo === 'SECADO' ? 'S':'G'}-${String(n).padStart(4,'0')}`,tipo,estado:'BORRADOR',id_usuario:usuario,clave_creacion:key,hash_creacion:hash,version:0,created_at:new Date(),updated_at:new Date()},t);
        } else {
            opId = Number(actual.id);
            await sql(`UPDATE produccion_operaciones SET ${Object.keys(header).map(k=>k+' = :'+k).join(',')},version=version+1,updated_at=NOW() WHERE id = :id`,{...header,id:opId},t);
        }
        await detalle(tipo,opId,d,t,!actual);
        await audit(opId,actual ? 'EDITAR_BORRADOR':'CREAR_BORRADOR',actual,d,usuario,t);
        return obtenerEtapa(tipo,opId,t);
    },externa);
}
export async function confirmarEtapa(tipo: Etapa, id: unknown, raw: Fila, usuario: number, externa?: Transaction) {
    const key = claveSolicitud(raw.clave_confirmacion);
    return tx(async t => {
        const o = await lock(tipo,id,t);
        if (o.estado === 'CONFIRMADO' && o.clave_confirmacion === key) return obtenerEtapa(tipo,o.id,t);
        if (o.estado !== 'BORRADOR') throw new ErrorDescarguio('El documento ya no es un borrador.',409);
        version(o,raw);
        const saved = await obtenerEtapa(tipo,o.id,t), d = validarEtapa(tipo,saved,true);
        const lots = await fuentes(tipo,d,t,true); await destinoValido(d,t);
        if (lots[0].modalidad === 'COMPRA') {
            const product = await Productos.findByPk(lots[0].id_producto,{transaction:t,lock:t.LOCK.UPDATE});
            const reserve = await ReservaProducto.findByPk(lots[0].id_producto,{transaction:t,lock:t.LOCK.UPDATE});
            const [balance] = await leerDesc("SELECT COALESCE(SUM(cantidad_disponible),0) cantidad FROM produccion_lotes WHERE id_producto = :id AND modalidad='COMPRA' AND estado='ACTIVO'",{id:lots[0].id_producto},t);
            if (!product || product.get('eliminado') || normalizarUnidadMedida(product.get('unidad_medida')) !== normalizarUnidadMedida(lots[0].unidad) || mil(balance.cantidad) > mil(product.get('stock'))-mil(reserve?.get('cantidad')))
                throw new ErrorDescarguio('El inventario propio disponible ya no respalda los lotes activos. Revise stock, reservas y unidades antes de confirmar.',409);
        }
        if (!d.id_ubicacion && d.destino_nombre) {
            await sql(`INSERT INTO produccion_ubicaciones (nombre,tipo,activo,created_at,updated_at) VALUES (:nombre,'SILO',1,NOW(),NOW()) ON DUPLICATE KEY UPDATE nombre=nombre`,{nombre:d.destino_nombre},t);
            const [u] = await leerDesc('SELECT id,activo FROM produccion_ubicaciones WHERE nombre = :nombre FOR UPDATE',{nombre:d.destino_nombre},t);
            if (!u.activo) throw new ErrorDescarguio('La ubicación existente está inactiva.',409);
            d.id_ubicacion = u.id;
            await sql(`UPDATE ${tabla(tipo)} SET id_ubicacion = :ubicacion WHERE id_operacion = :id`,{ubicacion:u.id,id:o.id},t);
        }
        let idxOrigen = 0;
        for (const l of lots) {
            const r = d.origenes.find((v:Fila)=>v.id_lote === Number(l.id)), qty = mil(r.cantidad), before = mil(l.cantidad_disponible), after = before-qty;
            await sql('UPDATE produccion_lotes SET cantidad_disponible = :saldo,estado = :estado,version=version+1,updated_at=NOW() WHERE id = :id',{saldo:after/1000,estado:after ? 'ACTIVO':'AGOTADO',id:l.id},t);
            idxOrigen += 1;
            const codigoLote = lots.length === 1 ? String(o.codigo) : `${o.codigo}-${idxOrigen}`;
            const result = await insert('produccion_lotes',{codigo:codigoLote,id_operacion_origen:o.id,id_producto:l.id_producto,modalidad:l.modalidad,id_propietario:l.id_propietario,id_productor:l.id_productor,variedad:l.variedad,
                cantidad_inicial:qty/1000,cantidad_disponible:qty/1000,unidad:l.unidad,etapa:tipo,estado_fisico:'CHALA_SECA',estado:'ACTIVO',id_ubicacion:d.id_ubicacion ?? l.id_ubicacion,
                ubicacion_detalle:d.ubicacion_detalle,id_usuario:usuario,version:0,created_at:new Date(),updated_at:new Date()},t);
            await sql('UPDATE produccion_etapa_origenes SET id_lote_resultado = :result WHERE id_operacion = :op AND id_lote = :lote',{result,op:o.id,lote:l.id},t);
            await insert('produccion_operacion_lotes',{id_operacion:o.id,id_lote:result,rol:'SALIDA',cantidad:qty/1000,unidad:l.unidad},t);
            for (const m of [{id_lote:l.id,tipo:'SALIDA',saldo_anterior:before/1000,saldo_resultante:after/1000},{id_lote:result,tipo:'ENTRADA',saldo_anterior:0,saldo_resultante:qty/1000}])
                await insert('produccion_movimientos',{...m,clave:`${tipo}:${o.id}:${m.id_lote}:${m.tipo}`,id_operacion:o.id,cantidad:qty/1000,unidad:l.unidad,id_ubicacion_origen:l.id_ubicacion,id_ubicacion_destino:d.id_ubicacion ?? l.id_ubicacion,fecha:new Date(),id_usuario:usuario,
                    observacion:'Traslado de cantidad de control; mediciones físicas registradas por separado.'},t);
        }
        await sql("UPDATE produccion_operaciones SET estado='CONFIRMADO',clave_confirmacion = :key,id_usuario_confirmacion = :usuario,confirmado_at=NOW(),version=version+1,updated_at=NOW() WHERE id = :id",{key,usuario,id:o.id},t);
        await audit(o.id,'CONFIRMAR',{estado:o.estado},{estado:'CONFIRMADO',origenes:d.origenes},usuario,t);
        return obtenerEtapa(tipo,o.id,t);
    },externa);
}
export async function anularEtapa(tipo: Etapa, id: unknown, raw: Fila, usuario: number, externa?: Transaction) {
    const motivo = typeof raw.motivo === 'string' ? raw.motivo.trim() : '';
    if (motivo.length < 5 || motivo.length > 1000) throw new ErrorDescarguio('Indique un motivo de 5 a 1000 caracteres.',400,{motivo:'Explique el motivo.'});
    return tx(async t => {
        const o = await lock(tipo,id,t);
        if (o.estado === 'ANULADO') return obtenerEtapa(tipo,o.id,t);
        version(o,raw);
        if (!['BORRADOR','CONFIRMADO'].includes(o.estado)) throw new ErrorDescarguio('Estado no anulable.',409);
        if (o.estado === 'CONFIRMADO') {
            const refs = await leerDesc('SELECT * FROM produccion_etapa_origenes WHERE id_operacion = :id ORDER BY id_lote',{id:o.id},t);
            for (const r of refs) {
                const [result] = await leerDesc('SELECT * FROM produccion_lotes WHERE id = :id FOR UPDATE',{id:r.id_lote_resultado},t);
                const deps = await leerDesc(`SELECT r.id FROM produccion_operacion_lotes r JOIN produccion_operaciones o ON o.id=r.id_operacion
                    WHERE r.id_lote = :id AND r.id_operacion <> :op AND o.estado <> 'ANULADO' LIMIT 1`,{id:result.id,op:o.id},t);
                const drafts = await leerDesc(`SELECT r.id FROM produccion_etapa_origenes r JOIN produccion_operaciones o ON o.id=r.id_operacion
                    WHERE r.id_lote = :id AND r.id_operacion <> :op AND o.estado <> 'ANULADO' LIMIT 1`,{id:result.id,op:o.id},t);
                const later = await leerDesc(`SELECT m.id FROM produccion_movimientos m JOIN produccion_operaciones o ON o.id=m.id_operacion
                    WHERE m.id_lote = :id AND m.id_operacion <> :op AND o.estado <> 'ANULADO' LIMIT 1`,{id:result.id,op:o.id},t);
                if (deps.length || drafts.length || later.length || result.estado !== 'ACTIVO' || mil(result.cantidad_disponible) !== mil(result.cantidad_inicial))
                    throw new ErrorDescarguio('Hay procesos dependientes o consumo del lote resultante. Anúlelos primero.',409);
                const [source] = await leerDesc('SELECT * FROM produccion_lotes WHERE id = :id FOR UPDATE',{id:r.id_lote},t);
                if (source.estado === 'ANULADO' || mil(source.cantidad_disponible)+mil(r.cantidad) > mil(source.cantidad_inicial)) throw new ErrorDescarguio('El saldo de origen no permite una reversión segura.',409);
                const movements = await leerDesc('SELECT * FROM produccion_movimientos WHERE id_operacion = :op AND id_lote IN (:ids) AND tipo IN (\'ENTRADA\',\'SALIDA\')',{op:o.id,ids:[source.id,result.id]},t);
                if (movements.length !== 2) throw new ErrorDescarguio('No se encontraron los dos movimientos originales.',409);
                for (const m of movements) {
                    const isSource = Number(m.id_lote) === Number(source.id), before = isSource ? mil(source.cantidad_disponible):mil(result.cantidad_disponible), after = isSource ? before+mil(r.cantidad):0;
                    await insert('produccion_movimientos',{clave:`${tipo}:${o.id}:REVERSO:${m.id}`,id_operacion:o.id,id_lote:m.id_lote,tipo:'REVERSO',cantidad:r.cantidad,unidad:m.unidad,saldo_anterior:before/1000,saldo_resultante:after/1000,id_movimiento_revertido:m.id,fecha:new Date(),id_usuario:usuario,observacion:motivo},t);
                    await sql('UPDATE produccion_lotes SET cantidad_disponible = :saldo,estado = :estado,version=version+1,updated_at=NOW() WHERE id = :id',{saldo:after/1000,estado:isSource ? 'ACTIVO':'ANULADO',id:m.id_lote},t);
                }
            }
        }
        await sql("UPDATE produccion_operaciones SET estado='ANULADO',id_usuario_anulacion = :usuario,anulado_at=NOW(),motivo_anulacion = :motivo,version=version+1,updated_at=NOW() WHERE id = :id",{usuario,motivo,id:o.id},t);
        await audit(o.id,'ANULAR',{estado:o.estado},{estado:'ANULADO'},usuario,t,motivo);
        return obtenerEtapa(tipo,o.id,t);
    },externa);
}
