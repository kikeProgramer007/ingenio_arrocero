import { DataTypes, ModelAttributeColumnOptions } from 'sequelize';

/** Esquema administrado por migraciones explícitas; no participa de sequelize.sync(). */
type Columnas = Record<string, ModelAttributeColumnOptions>;
export interface TablaProduccion { nombre: string; columnas: Columnas; indices?: string[][]; }
const id = (): ModelAttributeColumnOptions => ({ type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false });
const ref = (tabla: string, obligatorio = false): ModelAttributeColumnOptions => ({
    type: DataTypes.INTEGER, allowNull: !obligatorio, references: { model: tabla, key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE'
});
const texto = (largo = 150, obligatorio = false): ModelAttributeColumnOptions => ({ type: DataTypes.STRING(largo), allowNull: !obligatorio });
const cantidad = (obligatorio = false): ModelAttributeColumnOptions => ({ type: DataTypes.DECIMAL(18, 3).UNSIGNED, allowNull: !obligatorio });
const humedad = (): ModelAttributeColumnOptions => ({ type: DataTypes.DECIMAL(5, 2).UNSIGNED, allowNull: true });
const fechas = (): Columnas => ({ created_at: { type: DataTypes.DATE, allowNull: false }, updated_at: { type: DataTypes.DATE, allowNull: false } });
const operacion = (): Columnas => ({
    id_operacion: { ...ref('produccion_operaciones', true), primaryKey: true }
});

export const TIPOS_PRODUCCION = ['DESCARGUIO', 'SECADO', 'GUARDADO', 'PROCESADO', 'ENVASADO'] as const;
export type TipoProduccion = typeof TIPOS_PRODUCCION[number];
export const ESTADOS_PRODUCCION = ['BORRADOR', 'EN_CURSO', 'CONFIRMADO', 'ANULADO'] as const;
export const MODALIDADES_PRODUCCION = ['COMPRA', 'SERVICIO'] as const;

export const TABLAS_PRODUCCION: TablaProduccion[] = [
    { nombre: 'produccion_ubicaciones', columnas: {
        id: id(), nombre: { ...texto(150, true), unique: true }, tipo: { type: DataTypes.ENUM('SILO', 'ALMACEN', 'OTRO'), allowNull: false },
        id_padre: ref('produccion_ubicaciones'), descripcion: { type: DataTypes.TEXT, allowNull: true },
        activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }, ...fechas()
    } },
    { nombre: 'produccion_operaciones', columnas: {
        id: id(), codigo: { ...texto(40, true), unique: true }, tipo: { type: DataTypes.ENUM(...TIPOS_PRODUCCION), allowNull: false },
        fecha: { type: DataTypes.DATE, allowNull: false }, estado: { type: DataTypes.ENUM(...ESTADOS_PRODUCCION), allowNull: false, defaultValue: 'BORRADOR' },
        modalidad: { type: DataTypes.ENUM(...MODALIDADES_PRODUCCION), allowNull: false },
        // COMPRA: propietario NULL representa al ingenio; SERVICIO exige productor real al confirmar.
        id_propietario: ref('productores'), id_productor: ref('productores'), id_campana: ref('campanas'),
        responsable: texto(), observacion: { type: DataTypes.TEXT, allowNull: true },
        id_usuario: ref('user', true), id_usuario_confirmacion: ref('user'), confirmado_at: { type: DataTypes.DATE, allowNull: true },
        id_usuario_anulacion: ref('user'), anulado_at: { type: DataTypes.DATE, allowNull: true }, motivo_anulacion: { type: DataTypes.TEXT, allowNull: true },
        clave_confirmacion: { ...texto(80), unique: true }, version: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 }, ...fechas()
    }, indices: [['fecha', 'tipo', 'estado'], ['modalidad', 'id_propietario'], ['id_productor']] },
    { nombre: 'produccion_lotes', columnas: {
        id: id(), codigo: { ...texto(60, true), unique: true }, id_operacion_origen: ref('produccion_operaciones', true),
        id_producto: ref('productos', true), modalidad: { type: DataTypes.ENUM(...MODALIDADES_PRODUCCION), allowNull: false },
        id_propietario: ref('productores'), id_productor: ref('productores'), variedad: texto(100),
        cantidad_inicial: cantidad(true), cantidad_disponible: cantidad(true), unidad: texto(30, true),
        etapa: { type: DataTypes.ENUM(...TIPOS_PRODUCCION), allowNull: false },
        estado_fisico: { type: DataTypes.ENUM('CHALA_HUMEDA', 'CHALA_SECA', 'PROCESADO', 'ENVASADO'), allowNull: false },
        estado: { type: DataTypes.ENUM('ACTIVO', 'AGOTADO', 'ANULADO'), allowNull: false, defaultValue: 'ACTIVO' },
        id_ubicacion: ref('produccion_ubicaciones'), ubicacion_detalle: texto(200), id_usuario: ref('user', true),
        version: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 }, ...fechas()
    }, indices: [['id_operacion_origen'], ['modalidad', 'id_propietario'], ['etapa', 'estado'], ['id_producto']] },
    { nombre: 'produccion_operacion_lotes', columnas: {
        id: id(), id_operacion: ref('produccion_operaciones', true), id_lote: ref('produccion_lotes', true),
        rol: { type: DataTypes.ENUM('ENTRADA', 'SALIDA'), allowNull: false }, cantidad: cantidad(true), unidad: texto(30, true)
    }, indices: [['id_operacion', 'id_lote', 'rol'], ['id_lote']] },
    { nombre: 'produccion_descarguios', columnas: {
        ...operacion(), id_lote: { ...ref('produccion_lotes'), unique: true }, boleta: texto(80),
        // La relación es con la línea recibida, no solo con la cabecera financiera.
        id_compra_detalle: ref('compra_detalles'), id_movimiento_compra: ref('movimientos_inventario'),
        chofer: texto(), placa: texto(30), procedencia: texto(200), punto_descarga: texto(),
        id_ubicacion: ref('produccion_ubicaciones'), humedad_entrada: humedad(), impurezas_entrada: humedad(),
        impurezas_salida: humedad(), peso_real_kg: cantidad(), referencia_externa: texto(200)
    }, indices: [['id_compra_detalle'], ['boleta']] },
    { nombre: 'produccion_secados', columnas: {
        ...operacion(), secadora: texto(), silo: texto(), operador: texto(),
        inicio: { type: DataTypes.DATE, allowNull: true }, fin: { type: DataTypes.DATE, allowNull: true },
        humedad_entrada: humedad(), humedad_salida: humedad(), peso_salida: cantidad(), unidad_peso_salida: texto(30),
        merma_medida: cantidad(), unidad_merma: texto(30), justificacion_merma: { type: DataTypes.TEXT, allowNull: true }
    } },
    { nombre: 'produccion_guardados', columnas: {
        ...operacion(), id_ubicacion: ref('produccion_ubicaciones', true), ubicacion_detalle: texto(200)
    } },
    { nombre: 'produccion_procesados', columnas: {
        ...operacion(), maquina: texto(), peso_entrada_kg: cantidad(), peso_salida_kg: cantidad(),
        merma_medida: cantidad(), unidad_merma: texto(30), justificacion_merma: { type: DataTypes.TEXT, allowNull: true }
    } },
    { nombre: 'produccion_procesado_detalles', columnas: {
        id: id(), id_operacion: ref('produccion_operaciones', true), id_producto: ref('productos', true),
        id_lote_resultado: { ...ref('produccion_lotes'), unique: true }, clasificacion: texto(100),
        cantidad: cantidad(), unidad: texto(30, true), peso_real_kg: cantidad(), observacion: { type: DataTypes.TEXT, allowNull: true }
    }, indices: [['id_operacion']] },
    { nombre: 'produccion_envasados', columnas: {
        ...operacion(), id_producto_empaque: ref('productos', true), id_producto_destino: ref('productos', true),
        id_lote_resultado: { ...ref('produccion_lotes'), unique: true }, id_ubicacion: ref('produccion_ubicaciones'),
        presentacion: texto(150, true), numero_bolsas: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        contenido_bolsa_kg: cantidad(true), peso_total_kg: cantidad(true),
        equivalencia_kg_origen: { type: DataTypes.DECIMAL(18, 6).UNSIGNED, allowNull: true }, origen_equivalencia: texto(250)
    } },
    { nombre: 'produccion_movimientos', columnas: {
        id: id(), clave: { ...texto(100, true), unique: true }, id_operacion: ref('produccion_operaciones', true), id_lote: ref('produccion_lotes', true),
        tipo: { type: DataTypes.ENUM('ENTRADA', 'SALIDA', 'TRASLADO', 'REVERSO'), allowNull: false },
        cantidad: cantidad(true), unidad: texto(30, true), saldo_anterior: cantidad(true), saldo_resultante: cantidad(true),
        id_ubicacion_origen: ref('produccion_ubicaciones'), id_ubicacion_destino: ref('produccion_ubicaciones'),
        // Solo inventario propio se vincula al libro existente. No se copia ni se aplica dos veces.
        id_movimiento_inventario: { ...ref('movimientos_inventario'), unique: true },
        id_movimiento_revertido: { ...ref('produccion_movimientos'), unique: true },
        fecha: { type: DataTypes.DATE, allowNull: false }, id_usuario: ref('user', true), observacion: { type: DataTypes.TEXT, allowNull: true }
    }, indices: [['id_lote', 'fecha'], ['id_operacion']] },
    { nombre: 'produccion_auditoria', columnas: {
        id: id(), id_operacion: ref('produccion_operaciones'), id_lote: ref('produccion_lotes'), evento: texto(40, true),
        antes: { type: DataTypes.JSON, allowNull: true }, despues: { type: DataTypes.JSON, allowNull: true },
        motivo: { type: DataTypes.TEXT, allowNull: true }, fecha: { type: DataTypes.DATE, allowNull: false }, id_usuario: ref('user', true)
    }, indices: [['id_operacion', 'fecha'], ['id_lote', 'fecha']] },
    { nombre: 'produccion_secuencias', columnas: {
        tipo: { type: DataTypes.ENUM(...TIPOS_PRODUCCION), primaryKey: true, allowNull: false },
        gestion: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, allowNull: false },
        ultimo: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 }
    } }
];
