import { createHash } from 'crypto';
import { QueryTypes, Transaction } from 'sequelize';
import sequelize from '../db/connection';
import { Campana, CategoriaProducto, Compra, CompraDetalle, Proveedor, Productos, ReservaProducto } from '../models';
import { DatosDescarguio, ErrorDescarguio, claveSolicitud, validarDescarguio, versionDescarguio } from '../dtos/descarguio.dto';
import { normalizarUnidadMedida } from '../utils/unidad-medida';
import { inferirTipoCompra } from '../constants/compra.constants';
import { esProductoEmpaque } from '../utils/empaque';
import { mayusculizarDatos } from '../utils/mayusculas';

type Fila = Record<string, any>;
export async function leerDesc<T extends object = Fila>(sql: string, replacements: Record<string, any> = {}, transaction?: Transaction): Promise<T[]> {
    return sequelize.query<T>(sql, { replacements, transaction, type: QueryTypes.SELECT });
}
async function ejecutar(sql: string, replacements: Record<string, any>, transaction: Transaction) {
    return sequelize.query(sql, { replacements: mayusculizarDatos(replacements), transaction });
}
async function insertar(tabla: string, datos: Fila, transaction: Transaction): Promise<number> {
    const payload = mayusculizarDatos(datos);
    const columnas = Object.keys(payload);
    const [id] = await sequelize.query(`INSERT INTO ${tabla} (${columnas.map(c => '`' + c + '`').join(',')}) VALUES (${columnas.map(c => ':' + c).join(',')})`,
        { replacements: payload, transaction, type: QueryTypes.INSERT });
    return Number(id);
}
async function enTransaccion<T>(trabajo: (t: Transaction) => Promise<T>, externa?: Transaction): Promise<T> {
    return externa ? trabajo(externa) : sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, trabajo);
}
function enteroId(id: unknown): number {
    const n = Number(id);
    if (!Number.isSafeInteger(n) || n <= 0) throw new ErrorDescarguio('Código de descarguío inválido.');
    return n;
}
function mil(valor: unknown): number { return Math.round(Number(valor || 0) * 1000); }
const CAMPOS_DETALLE = ['id_producto', 'cantidad', 'unidad', 'variedad', 'id_compra_detalle', 'id_recepcion_compra', 'boleta', 'chofer', 'placa',
    'procedencia', 'localidad', 'id_ubicacion', 'punto_descarga', 'ubicacion_detalle', 'humedad_entrada', 'impurezas_entrada', 'impurezas_salida', 'peso_real_kg'] as const;
function datosDetalle(datos: DatosDescarguio): Fila { return Object.fromEntries(CAMPOS_DETALLE.map(campo => [campo, datos[campo]])); }

async function auditar(id: number, evento: string, antes: unknown, despues: unknown, usuario: number, t: Transaction, motivo: string | null = null) {
    await insertar('produccion_auditoria', { id_operacion: id, evento, antes: antes == null ? null : JSON.stringify(antes),
        despues: despues == null ? null : JSON.stringify(despues), motivo, fecha: new Date(), id_usuario: usuario }, t);
}
async function cargarBloqueado(id: number, t: Transaction): Promise<Fila> {
    const [operacion] = await leerDesc("SELECT * FROM produccion_operaciones WHERE id= :id AND tipo='DESCARGUIO' FOR UPDATE", { id }, t);
    if (!operacion) throw new ErrorDescarguio('No se encontró el descarguío.', 404);
    const [detalle] = await leerDesc('SELECT * FROM produccion_descarguios WHERE id_operacion= :id', { id }, t);
    if (!detalle) throw new ErrorDescarguio('El descarguío no tiene sus datos de recepción.', 409);
    return { ...operacion, ...detalle };
}
function comprobarVersion(registro: Fila, version: unknown) {
    if (versionDescarguio(version) !== Number(registro.version)) throw new ErrorDescarguio('Otro usuario modificó el descarguío. Vuelva a abrirlo antes de guardar.', 409);
}
async function validarReferencias(datos: DatosDescarguio, t: Transaction, confirmar = false) {
    if (datos.id_productor) {
        const productor = await Proveedor.findByPk(datos.id_productor, { transaction: t, lock: t.LOCK.UPDATE });
        if (!productor || !productor.get('activo')) throw new ErrorDescarguio('Seleccione un productor activo.', 400, { id_productor: 'El productor no existe o está inactivo.' });
    }
    if (datos.id_producto) {
        const producto = await Productos.findByPk(datos.id_producto, { transaction: t, ...(confirmar && datos.modalidad === 'SERVICIO' ? { lock: t.LOCK.UPDATE } : {}) });
        if (!producto || producto.get('eliminado')) throw new ErrorDescarguio('Seleccione un producto vigente para identificar el arroz.', 400, { id_producto: 'Producto no disponible.' });
        const categoria = producto.get('id_categoria') ? await CategoriaProducto.findByPk(Number(producto.get('id_categoria')), { transaction: t }) : null;
        if (esProductoEmpaque({ nombre: producto.get('nombre'), categoria: categoria ? { nombre: categoria.get('nombre') } : null }))
            throw new ErrorDescarguio('Seleccione el producto de arroz, no un tipo de bolsa o empaque.', 400, { id_producto: 'Un descarguío debe identificar el arroz recibido.' });
    }
    if (datos.id_campana) {
        const campana = await Campana.findByPk(datos.id_campana, { transaction: t });
        if (!campana) throw new ErrorDescarguio('La campaña no existe.', 400, { id_campana: 'Campaña no disponible.' });
    }
    if (datos.id_ubicacion) {
        const [ubicacion] = await leerDesc('SELECT id FROM produccion_ubicaciones WHERE id= :id AND activo=1', { id: datos.id_ubicacion }, t);
        if (!ubicacion) throw new ErrorDescarguio('Seleccione una ubicación activa o escriba una nueva.', 400, { id_ubicacion: 'Ubicación no disponible.' });
    }
    if (datos.id_compra_detalle) {
        const detalle = await CompraDetalle.findByPk(datos.id_compra_detalle, { transaction: t });
        if (!detalle) throw new ErrorDescarguio('La línea de compra no existe.', 400, { id_compra_detalle: 'Seleccione una compra válida.' });
        if (datos.id_recepcion_compra) {
            const [recepcion] = await leerDesc('SELECT id FROM recepciones_compra WHERE id= :id AND id_detalle= :detalle', { id: datos.id_recepcion_compra, detalle: datos.id_compra_detalle }, t);
            if (!recepcion) throw new ErrorDescarguio('La recepción no pertenece a la línea de compra seleccionada.', 400, { id_recepcion_compra: 'Recepción inválida.' });
        }
    }
}

export async function obtenerDescarguio(id: unknown, t?: Transaction): Promise<Fila> {
    const [fila] = await leerDesc(`SELECT o.*, d.*, p.nombre productor_nombre, pr.nombre producto_nombre,
        u.nombre ubicacion_nombre, cd.id_compra, c.boleta compra_boleta, l.codigo lote_codigo, l.cantidad_disponible,
        CASE WHEN o.modalidad='COMPRA' THEN 'Ingenio (propio)' ELSE p.nombre END propietario_nombre
        FROM produccion_operaciones o JOIN produccion_descarguios d ON d.id_operacion=o.id
        LEFT JOIN proveedores p ON p.id=o.id_productor LEFT JOIN productos pr ON pr.id=d.id_producto
        LEFT JOIN produccion_ubicaciones u ON u.id=d.id_ubicacion LEFT JOIN compra_detalles cd ON cd.id=d.id_compra_detalle
        LEFT JOIN compras c ON c.id=cd.id_compra LEFT JOIN produccion_lotes l ON l.id=d.id_lote
        WHERE o.id= :id AND o.tipo='DESCARGUIO'`, { id: enteroId(id) }, t);
    if (!fila) throw new ErrorDescarguio('No se encontró el descarguío.', 404);
    const historial = await leerDesc(`SELECT a.id, a.evento, a.fecha, a.motivo, COALESCE(NULLIF(u.nombre,''),u.username) usuario
        FROM produccion_auditoria a LEFT JOIN user u ON u.id=a.id_usuario WHERE a.id_operacion= :id ORDER BY a.id`, { id: fila.id }, t);
    return { ...fila, historial };
}

export async function crearDescarguio(raw: Fila, usuario: number, externa?: Transaction): Promise<Fila> {
    const datos = validarDescarguio(raw);
    const clave = claveSolicitud(raw.clave_creacion);
    const hash = createHash('sha256').update(JSON.stringify(datos)).digest('hex');
    return enTransaccion(async t => {
        const gestion = Number(new Intl.DateTimeFormat('en', { timeZone: 'America/La_Paz', year: 'numeric' }).format(datos.fecha));
        // Una fila por gestión serializa la asignación del correlativo y los reintentos de creación.
        await ejecutar("INSERT INTO produccion_secuencias (tipo,gestion,ultimo) VALUES ('DESCARGUIO',:gestion,0) ON DUPLICATE KEY UPDATE ultimo=ultimo", { gestion }, t);
        const [secuencia] = await leerDesc("SELECT ultimo FROM produccion_secuencias WHERE tipo='DESCARGUIO' AND gestion= :gestion FOR UPDATE", { gestion }, t);
        const [existente] = await leerDesc('SELECT id,hash_creacion FROM produccion_operaciones WHERE clave_creacion= :clave', { clave }, t);
        if (existente) {
            if (existente.hash_creacion !== hash) throw new ErrorDescarguio('Esa solicitud ya se guardó con otros datos. Consulte el registro existente.', 409);
            return obtenerDescarguio(existente.id, t);
        }
        await validarReferencias(datos, t);
        const numero = Number(secuencia.ultimo) + 1;
        const codigo = `D-${String(numero).padStart(4, '0')}`;
        await ejecutar("UPDATE produccion_secuencias SET ultimo= :numero WHERE tipo='DESCARGUIO' AND gestion= :gestion", { numero, gestion }, t);
        const ahora = new Date();
        const id = await insertar('produccion_operaciones', { codigo, tipo: 'DESCARGUIO', fecha: datos.fecha, estado: 'BORRADOR', modalidad: datos.modalidad,
            id_productor: datos.id_productor, id_propietario: datos.modalidad === 'SERVICIO' ? datos.id_productor : null,
            id_campana: datos.id_campana, responsable: datos.responsable, observacion: datos.observacion, id_usuario: usuario,
            clave_creacion: clave, hash_creacion: hash, version: 0, created_at: ahora, updated_at: ahora }, t);
        await insertar('produccion_descarguios', { id_operacion: id, ...datosDetalle(datos) }, t);
        await auditar(id, 'CREAR_BORRADOR', null, datos, usuario, t);
        return obtenerDescarguio(id, t);
    }, externa);
}

export async function editarDescarguio(id: unknown, raw: Fila, usuario: number, externa?: Transaction): Promise<Fila> {
    const datos = validarDescarguio(raw);
    return enTransaccion(async t => {
        const actual = await cargarBloqueado(enteroId(id), t);
        if (actual.estado !== 'BORRADOR') throw new ErrorDescarguio('Solo puede editar un descarguío en borrador.', 409);
        comprobarVersion(actual, raw.version);
        await validarReferencias(datos, t);
        await ejecutar(`UPDATE produccion_operaciones SET fecha= :fecha, modalidad= :modalidad, id_productor= :id_productor,
            id_propietario= :propietario, id_campana= :id_campana, responsable= :responsable, observacion= :observacion,
            version=version+1, updated_at=NOW() WHERE id= :id`, { ...datos, propietario: datos.modalidad === 'SERVICIO' ? datos.id_productor : null, id: actual.id }, t);
        const detalle = datosDetalle(datos);
        await ejecutar(`UPDATE produccion_descarguios SET ${CAMPOS_DETALLE.map(c => '`' + c + '`=:' + c).join(',')} WHERE id_operacion= :id`, { ...detalle, id: actual.id }, t);
        await auditar(actual.id, 'EDITAR_BORRADOR', actual, datos, usuario, t);
        return obtenerDescarguio(actual.id, t);
    }, externa);
}

async function validarCompraRecibida(datos: DatosDescarguio, t: Transaction) {
    const referencia = await CompraDetalle.findByPk(datos.id_compra_detalle!, { transaction: t });
    if (!referencia) throw new ErrorDescarguio('No se encontró la línea de compra.', 409);
    // Mismo orden que recepción en Compras: cabecera -> detalle -> producto -> reservas.
    const compra = await Compra.findByPk(Number(referencia.get('id_compra')), { transaction: t, lock: t.LOCK.UPDATE });
    const detalle = await CompraDetalle.findByPk(datos.id_compra_detalle!, { transaction: t, lock: t.LOCK.UPDATE });
    if (!compra || !detalle || compra.get('estado') === 'ANULADA') throw new ErrorDescarguio('La compra no está vigente.', 409);
    if (inferirTipoCompra(compra.get({ plain: true }) as any) !== 'CHALA') throw new ErrorDescarguio('La compra debe corresponder a arroz en chala.', 409);
    if (Number(compra.get('id_proveedor')) !== datos.id_productor) throw new ErrorDescarguio('El productor no coincide con la compra.', 409, { id_productor: 'Seleccione el productor de la compra.' });
    if (Number(detalle.get('id_producto')) !== datos.id_producto) throw new ErrorDescarguio('El producto no coincide con la línea de compra.', 409, { id_producto: 'Use el producto de la compra.' });
    const producto = await Productos.findByPk(datos.id_producto!, { transaction: t, lock: t.LOCK.UPDATE });
    if (!producto || producto.get('eliminado')) throw new ErrorDescarguio('El producto ya no está disponible.', 409);
    const unidad = normalizarUnidadMedida(detalle.get('unidad') || producto.get('unidad_medida'));
    if (unidad !== datos.unidad || unidad !== normalizarUnidadMedida(producto.get('unidad_medida')))
        throw new ErrorDescarguio('La unidad debe coincidir con la compra y el inventario. No hay una conversión autorizada.', 409, { unidad: 'Las unidades no coinciden.' });
    const [asignado] = await leerDesc(`SELECT COALESCE(SUM(d.cantidad),0) cantidad FROM produccion_descarguios d JOIN produccion_operaciones o ON o.id=d.id_operacion
        WHERE d.id_compra_detalle= :detalle AND o.estado='CONFIRMADO'`, { detalle: datos.id_compra_detalle }, t);
    if (mil(asignado.cantidad) + mil(datos.cantidad) > mil(detalle.get('cantidad_recibida')))
        throw new ErrorDescarguio('La cantidad supera lo recibido y todavía no vinculado. Registre la recepción pendiente desde Compras.', 409, { cantidad: 'No hay suficiente cantidad recibida sin vincular.' });
    if (datos.id_recepcion_compra) {
        const [recepcion] = await leerDesc('SELECT * FROM recepciones_compra WHERE id= :id AND id_detalle= :detalle FOR UPDATE', { id: datos.id_recepcion_compra, detalle: datos.id_compra_detalle }, t);
        const [usado] = await leerDesc(`SELECT COALESCE(SUM(d.cantidad),0) cantidad FROM produccion_descarguios d JOIN produccion_operaciones o ON o.id=d.id_operacion
            WHERE d.id_recepcion_compra= :id AND o.estado='CONFIRMADO'`, { id: datos.id_recepcion_compra }, t);
        if (!recepcion || mil(usado.cantidad) + mil(datos.cantidad) > mil(recepcion.cantidad)) throw new ErrorDescarguio('La recepción seleccionada no tiene suficiente cantidad sin vincular.', 409);
    }
    const [ingreso] = await leerDesc(`SELECT COALESCE(SUM(cantidad),0) cantidad FROM movimientos_inventario WHERE origen='COMPRA'
        AND origen_id= :compra AND id_producto= :producto AND tipo='ENTRADA'`, { compra: compra.get('id'), producto: datos.id_producto }, t);
    const [vinculado] = await leerDesc(`SELECT COALESCE(SUM(d.cantidad),0) cantidad FROM produccion_descarguios d JOIN produccion_operaciones o ON o.id=d.id_operacion
        JOIN compra_detalles cd ON cd.id=d.id_compra_detalle WHERE cd.id_compra= :compra AND d.id_producto= :producto AND o.estado='CONFIRMADO'`,
        { compra: compra.get('id'), producto: datos.id_producto }, t);
    if (mil(vinculado.cantidad) + mil(datos.cantidad) > mil(ingreso.cantidad)) throw new ErrorDescarguio('No hay una entrada de inventario de Compras que respalde esa cantidad.', 409);
    const reserva = await ReservaProducto.findByPk(datos.id_producto!, { transaction: t, lock: t.LOCK.UPDATE });
    const lotes = await leerDesc(`SELECT unidad,SUM(cantidad_disponible) cantidad FROM produccion_lotes
        WHERE id_producto= :producto AND modalidad='COMPRA' AND estado='ACTIVO' GROUP BY unidad`, { producto: datos.id_producto }, t);
    if (lotes.some(l => normalizarUnidadMedida(l.unidad) !== datos.unidad)) throw new ErrorDescarguio('Existen lotes propios del producto en otra unidad. Revise sus equivalencias antes de vincular más arroz.', 409);
    if (lotes.reduce((s,l) => s + mil(l.cantidad), 0) + mil(datos.cantidad) > mil(producto.get('stock')) - mil(reserva?.get('cantidad')))
        throw new ErrorDescarguio('El stock propio disponible no alcanza para respaldar este lote y los lotes activos. Revise las existencias y reservas.', 409);
}

export async function confirmarDescarguio(id: unknown, raw: Fila, usuario: number, externa?: Transaction): Promise<Fila> {
    const clave = claveSolicitud(raw.clave_confirmacion);
    return enTransaccion(async t => {
        const actual = await cargarBloqueado(enteroId(id), t);
        if (actual.estado === 'CONFIRMADO' && actual.clave_confirmacion === clave) return obtenerDescarguio(actual.id, t);
        if (actual.estado !== 'BORRADOR') throw new ErrorDescarguio('El descarguío ya fue confirmado o anulado.', 409);
        comprobarVersion(actual, raw.version);
        const datos = validarDescarguio(actual, true);
        await validarReferencias(datos, t, true);
        if (datos.modalidad === 'COMPRA') await validarCompraRecibida(datos, t);
        let ubicacion = datos.id_ubicacion;
        if (!ubicacion && datos.punto_descarga) {
            await ejecutar(`INSERT INTO produccion_ubicaciones (nombre,tipo,activo,created_at,updated_at) VALUES (:nombre,'OTRO',1,NOW(),NOW())
                ON DUPLICATE KEY UPDATE id=id`, { nombre: datos.punto_descarga }, t);
            const [fila] = await leerDesc('SELECT id,activo FROM produccion_ubicaciones WHERE nombre= :nombre FOR UPDATE', { nombre: datos.punto_descarga }, t);
            if (!fila.activo) throw new ErrorDescarguio('La ubicación escrita está inactiva. Seleccione otra.', 409);
            ubicacion = Number(fila.id);
        }
        const ahora = new Date();
        const lote = await insertar('produccion_lotes', { codigo: actual.codigo, id_operacion_origen: actual.id,
            id_producto: datos.id_producto, modalidad: datos.modalidad, id_propietario: datos.modalidad === 'SERVICIO' ? datos.id_productor : null,
            id_productor: datos.id_productor, variedad: datos.variedad, cantidad_inicial: datos.cantidad, cantidad_disponible: datos.cantidad,
            unidad: datos.unidad, etapa: 'DESCARGUIO', estado_fisico: 'CHALA_HUMEDA', estado: 'ACTIVO', id_ubicacion: ubicacion,
            ubicacion_detalle: datos.ubicacion_detalle, id_usuario: usuario, version: 0, created_at: ahora, updated_at: ahora }, t);
        await insertar('produccion_operacion_lotes', { id_operacion: actual.id, id_lote: lote, rol: 'SALIDA', cantidad: datos.cantidad, unidad: datos.unidad }, t);
        await insertar('produccion_movimientos', { clave: `DESCARGUIO:${actual.id}:ENTRADA`, id_operacion: actual.id, id_lote: lote,
            tipo: 'ENTRADA', cantidad: datos.cantidad, unidad: datos.unidad, saldo_anterior: 0, saldo_resultante: datos.cantidad,
            id_ubicacion_destino: ubicacion, fecha: ahora, id_usuario: usuario,
            observacion: datos.modalidad === 'COMPRA' ? 'Trazabilidad de compra ya recibida; no genera otra entrada al stock propio.' : 'Recepción en custodia de tercero; no aumenta stock propio.' }, t);
        await ejecutar('UPDATE produccion_descarguios SET id_lote= :lote,id_ubicacion= :ubicacion WHERE id_operacion= :id', { lote, ubicacion, id: actual.id }, t);
        await ejecutar(`UPDATE produccion_operaciones SET estado='CONFIRMADO',clave_confirmacion= :clave,id_usuario_confirmacion= :usuario,
            confirmado_at= :ahora,updated_at= :ahora,version=version+1 WHERE id= :id`, { clave, usuario, ahora, id: actual.id }, t);
        await auditar(actual.id, 'CONFIRMAR', { estado: actual.estado }, { estado: 'CONFIRMADO', id_lote: lote, cantidad: datos.cantidad, unidad: datos.unidad, modalidad: datos.modalidad }, usuario, t);
        return obtenerDescarguio(actual.id, t);
    }, externa);
}

export async function anularDescarguio(id: unknown, raw: Fila, usuario: number, externa?: Transaction): Promise<Fila> {
    const motivo = typeof raw.motivo === 'string' ? raw.motivo.trim() : '';
    if (motivo.length < 5 || motivo.length > 1000) throw new ErrorDescarguio('Indique un motivo de anulación de 5 a 1000 caracteres.', 400, { motivo: 'Describa el motivo.' });
    return enTransaccion(async t => {
        const actual = await cargarBloqueado(enteroId(id), t);
        if (actual.estado === 'ANULADO') return obtenerDescarguio(actual.id, t);
        comprobarVersion(actual, raw.version);
        if (!['BORRADOR', 'CONFIRMADO'].includes(actual.estado)) throw new ErrorDescarguio('No se puede anular en el estado actual.', 409);
        if (actual.estado === 'CONFIRMADO') {
            const [lote] = await leerDesc('SELECT * FROM produccion_lotes WHERE id= :id FOR UPDATE', { id: actual.id_lote }, t);
            const vinculados = await leerDesc("SELECT r.id FROM produccion_operacion_lotes r JOIN produccion_operaciones o ON o.id=r.id_operacion WHERE r.id_lote = :lote AND r.id_operacion <> :id AND o.estado <> 'ANULADO' LIMIT 1", { lote: actual.id_lote, id: actual.id }, t);
            const movimientos = await leerDesc("SELECT m.id FROM produccion_movimientos m JOIN produccion_operaciones o ON o.id=m.id_operacion WHERE m.id_lote = :lote AND m.id_operacion <> :id AND o.estado <> 'ANULADO' LIMIT 1", { lote: actual.id_lote, id: actual.id }, t);
            const [etapas] = await leerDesc("SELECT version FROM produccion_migraciones WHERE version='20261105-produccion-secados-guardados'",{},t);
            const borradores = etapas ? await leerDesc("SELECT r.id FROM produccion_etapa_origenes r JOIN produccion_operaciones o ON o.id=r.id_operacion WHERE r.id_lote = :lote AND o.estado <> 'ANULADO' LIMIT 1",{lote:actual.id_lote},t) : [];
            if (!lote || vinculados.length || movimientos.length || borradores.length || lote.etapa !== 'DESCARGUIO' || lote.estado !== 'ACTIVO' || mil(lote.cantidad_disponible) !== mil(lote.cantidad_inicial))
                throw new ErrorDescarguio('El lote ya tiene movimientos o procesos relacionados. Deben revertirse antes de anular el descarguío.', 409);
            const [entrada] = await leerDesc("SELECT id FROM produccion_movimientos WHERE id_operacion= :id AND tipo='ENTRADA' AND id_lote= :lote", { id: actual.id, lote: lote.id }, t);
            if (!entrada) throw new ErrorDescarguio('No se encontró la entrada del lote para revertirla.', 409);
            await insertar('produccion_movimientos', { clave: `DESCARGUIO:${actual.id}:REVERSO`, id_operacion: actual.id, id_lote: lote.id,
                tipo: 'REVERSO', cantidad: lote.cantidad_disponible, unidad: lote.unidad, saldo_anterior: lote.cantidad_disponible, saldo_resultante: 0,
                id_movimiento_revertido: entrada.id, fecha: new Date(), id_usuario: usuario, observacion: motivo }, t);
            await ejecutar("UPDATE produccion_lotes SET estado='ANULADO',cantidad_disponible=0,version=version+1,updated_at=NOW() WHERE id= :id", { id: lote.id }, t);
        }
        await ejecutar(`UPDATE produccion_operaciones SET estado='ANULADO',id_usuario_anulacion= :usuario,anulado_at=NOW(),
            motivo_anulacion= :motivo,version=version+1,updated_at=NOW() WHERE id= :id`, { usuario, motivo, id: actual.id }, t);
        await auditar(actual.id, 'ANULAR', { estado: actual.estado }, { estado: 'ANULADO' }, usuario, t, motivo);
        return obtenerDescarguio(actual.id, t);
    }, externa);
}
