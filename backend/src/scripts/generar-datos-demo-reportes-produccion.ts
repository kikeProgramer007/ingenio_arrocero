import '../load-env';
import { randomUUID } from 'crypto';
import { sequelize, Productor, Productos, User } from '../models';
import { Transaction } from 'sequelize';
import { crearDescarguio, confirmarDescarguio } from '../servicios/descarguios.servicio';
import { guardarEtapa, confirmarEtapa } from '../servicios/produccion-etapas.servicio';
import { guardarTransformacion, confirmarTransformacion } from '../servicios/produccion-transformaciones.servicio';

/** Datos persistentes, ficticios y trazables para revisar los cuatro reportes de producción. */
async function main() {
    await sequelize.authenticate();
    if (process.env.NODE_ENV !== 'development' || sequelize.getDatabaseName() !== 'db_empresa_rojas') {
        throw new Error(`Generación cancelada: solo permitida en desarrollo sobre db_empresa_rojas (entorno=${process.env.NODE_ENV}, base=${sequelize.getDatabaseName()}).`);
    }

    const marca = 'PRUEBA-REPORTES-ROJAS-202611';
    const existente = await Productor.findOne({ where: { nombre: `PRODUCTOR ${marca}` } });
    if (existente) {
        console.log(JSON.stringify({ resultado: 'ya_generado', productor: existente.get('nombre'), nota: 'No se duplicaron datos.' }));
        return;
    }

    const usuario = await User.findOne({ where: { activo: true, eliminado: false } });
    if (!usuario) throw new Error('No hay un usuario activo para registrar la auditoría de los datos de prueba.');
    const idUsuario = Number(usuario.get('id'));
    const transaccion = await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED });
    let chala = 0, entero = 0, tresCuartos = 0, granillo = 0, idProductor = 0;
    const iso = (dia: number, hora = 12) => `2026-11-${String(dia).padStart(2, '0')}T${String(hora).padStart(2, '0')}:00:00.000Z`;
    const claves = () => randomUUID();

    try {
        const productor = await Productor.create({ nombre: `PRODUCTOR ${marca}`, activo: true }, { transaction: transaccion });
        idProductor = Number(productor.get('id'));
        const producto = async (nombre: string, unidad_medida: string) => Number((await Productos.create({
            nombre: `${nombre} ${marca}`, unidad_medida, stock: 0
        }, { transaction: transaccion })).get('id'));
        chala = await producto('ARROZ EN CHALA', 'Fanega');
        entero = await producto('ARROZ ENTERO DE PRUEBA', 'Quintal');
        tresCuartos = await producto('ARROZ 3/4 DE PRUEBA', 'Quintal');
        granillo = await producto('GRANILLO DE PRUEBA', 'Quintal');
        const recepcion = await crearDescarguio({
            fecha: iso(2, 7), modalidad: 'SERVICIO', id_productor: idProductor, id_producto: chala,
            boleta: `${marca}-BOLETA-001`, variedad: 'MAC-18 (PRUEBA)', cantidad: 120, unidad: 'Fanega',
            chofer: 'CHOFER DE PRUEBA', placa: 'PRB-001', procedencia: 'Origen de prueba', localidad: 'Montero (prueba)',
            humedad_entrada: 18.5, impurezas_entrada: 4.4, responsable: 'OPERADOR DE PRUEBA',
            observacion: `DATO SIMULADO PARA VALIDAR REPORTES ${marca}`, clave_creacion: claves()
        }, idUsuario, transaccion);
        const descarguio = await confirmarDescarguio(recepcion.id, { version: recepcion.version, clave_confirmacion: claves() }, idUsuario, transaccion);

        const secadoBorrador = await guardarEtapa('SECADO', null, {
            fecha: iso(3, 8), origenes: [{ id_lote: descarguio.id_lote, cantidad: 120 }],
            secadora: 'SECADORA DE PRUEBA 1', silo: 'SILO DE PRUEBA A', operador: 'OPERADOR DE PRUEBA',
            inicio: iso(3, 8), fin: iso(3, 18), humedad_entrada: 18.5, humedad_salida: 11.3,
            responsable: 'RESPONSABLE DE PRUEBA', observacion: `CICLO SIMULADO ${marca}`,
            clave_creacion: claves()
        }, idUsuario, transaccion);
        const secado = await confirmarEtapa('SECADO', secadoBorrador.id, { version: secadoBorrador.version, clave_confirmacion: claves() }, idUsuario, transaccion);
        const loteSeco = Number(secado.origenes[0].id_lote_resultado);

        const guardadoBorrador = await guardarEtapa('GUARDADO', null, {
            fecha: iso(4, 9), origenes: [{ id_lote: loteSeco, cantidad: 120 }],
            destino_nombre: 'ALMACÉN DE PRUEBA ROJAS', ubicacion_detalle: 'N-1 / 5A / 3 (PRUEBA)',
            responsable: 'RESPONSABLE DE PRUEBA', condicion: 'Seco', observacion: `UBICACIÓN SIMULADA ${marca}`,
            clave_creacion: claves()
        }, idUsuario, transaccion);
        const guardado = await confirmarEtapa('GUARDADO', guardadoBorrador.id, { version: guardadoBorrador.version, clave_confirmacion: claves() }, idUsuario, transaccion);
        const loteGuardado = Number(guardado.origenes[0].id_lote_resultado);

        const procesadoBorrador = await guardarTransformacion('PROCESADO', null, {
            fecha: iso(5, 10), origenes: [{ id_lote: loteGuardado, cantidad: 80 }],
            maquina: 'LÍNEA DE PILADO DE PRUEBA', peso_entrada_kg: 4000,
            resultados: [
                { id_producto: entero, clasificacion: 'Arroz entero (prueba)', cantidad: 44, unidad: 'Quintal', peso_real_kg: 2024, observacion: 'Resultado simulado' },
                { id_producto: tresCuartos, clasificacion: 'Arroz 3/4 (prueba)', cantidad: 15, unidad: 'Quintal', peso_real_kg: 690, observacion: 'Resultado simulado' },
                { id_producto: granillo, clasificacion: 'Granillo (prueba)', cantidad: 4, unidad: 'Quintal', peso_real_kg: 184, observacion: 'Subproducto simulado' }
            ],
            observacion: `PROCESADO SIMULADO; NO ES PRODUCCIÓN REAL ${marca}`, clave_creacion: claves()
        }, idUsuario, transaccion);
        const procesado = await confirmarTransformacion('PROCESADO', procesadoBorrador.id, { version: procesadoBorrador.version, clave_confirmacion: claves() }, idUsuario, transaccion);
        await transaccion.commit();

        console.log(JSON.stringify({
            resultado: 'generado', entorno: process.env.NODE_ENV, base: sequelize.getDatabaseName(),
            identificadorPrueba: marca,
            productor: productor.get('nombre'),
            productoEntrada: `ARROZ EN CHALA ${marca}`,
            registros: {
                descarguio: descarguio.codigo,
                secado: secado.codigo,
                guardado: guardado.codigo,
                procesado: procesado.codigo
            },
            cantidades: { recibidoYSecado: '120 fanegas', almacenado: '120 fanegas', procesado: '80 fanegas' },
            trazabilidad: 'Descarguío → secado → guardado → procesado',
            datosReales: 'sin cambios; modalidad SERVICIO y productos/productor identificados como PRUEBA'
        }));
    } catch (error) {
        await transaccion.rollback();
        throw error;
    }
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => sequelize.close());
