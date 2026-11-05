import { ErrorConsultaProduccion } from '../servicios/produccion-consulta.servicio';
import { normalizarUnidadMedida, esUnidadMedidaValida } from '../utils/unidad-medida';

export class ErrorDescarguio extends ErrorConsultaProduccion {
    constructor(mensaje: string, status = 400, public campos?: Record<string, string>) { super(mensaje, status); }
}
export interface DatosDescarguio {
    fecha: Date; modalidad: 'COMPRA' | 'SERVICIO'; id_productor: number | null; id_producto: number | null;
    id_compra_detalle: number | null; id_recepcion_compra: number | null; id_campana: number | null;
    boleta: string | null; chofer: string | null; placa: string | null; procedencia: string | null; localidad: string | null;
    variedad: string | null; cantidad: number | null; unidad: string | null; humedad_entrada: number | null;
    impurezas_entrada: number | null; impurezas_salida: number | null; peso_real_kg: number | null;
    id_ubicacion: number | null; punto_descarga: string | null; ubicacion_detalle: string | null;
    responsable: string | null; observacion: string | null;
}
export function claveSolicitud(valor: unknown): string {
    if (typeof valor !== 'string' || !/^[A-Za-z0-9_-]{16,80}$/.test(valor)) throw new ErrorDescarguio('Identificador de solicitud inválido. Vuelva a abrir el formulario.');
    return valor;
}
export function versionDescarguio(valor: unknown): number {
    if (valor == null || !Number.isSafeInteger(Number(valor)) || Number(valor) < 0) throw new ErrorDescarguio('Falta la versión del registro. Vuelva a consultarlo.');
    return Number(valor);
}
export function validarDescarguio(raw: Record<string, unknown>, confirmar = false): DatosDescarguio {
    const campos: Record<string, string> = {};
    const txt = (campo: string, max: number): string | null => {
        const valor = raw[campo];
        if (valor == null || valor === '') return null;
        if (typeof valor !== 'string' || valor.trim().length > max) { campos[campo] = `Admite hasta ${max} caracteres.`; return null; }
        return valor.trim() || null;
    };
    const id = (campo: string): number | null => {
        if (raw[campo] == null || raw[campo] === '') return null;
        const valor = Number(raw[campo]);
        if (!['number','string'].includes(typeof raw[campo]) || !Number.isSafeInteger(valor) || valor <= 0 || valor > 2147483647) { campos[campo] = 'Seleccione un registro válido.'; return null; }
        return valor;
    };
    const decimal = (campo: string, decimales: number, max: number, cero = true): number | null => {
        const valor = raw[campo];
        if (valor == null || valor === '') return null;
        if (!['number', 'string'].includes(typeof valor) || !new RegExp(`^\\d+(?:\\.\\d{1,${decimales}})?$`).test(String(valor)) || !Number.isFinite(Number(valor)) || Number(valor) > max || (!cero && Number(valor) <= 0)) {
            campos[campo] = `Ingrese ${cero ? 'un valor de 0' : 'una cantidad mayor que 0'} a ${max}, con hasta ${decimales} decimales.`; return null;
        }
        return Number(valor);
    };
    const fecha = raw.fecha instanceof Date ? raw.fecha : new Date(String(raw.fecha));
    const fechaTexto = typeof raw.fecha === 'string' ? raw.fecha : '';
    if (!Number.isFinite(fecha.getTime()) || (fechaTexto && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(fechaTexto)
        || fecha.toISOString().slice(0, 19) !== fechaTexto.slice(0, 19)))) campos.fecha = 'Ingrese una fecha y hora válidas.';
    const modalidad = String(raw.modalidad);
    if (!['COMPRA', 'SERVICIO'].includes(modalidad)) campos.modalidad = 'Seleccione Compra o Servicio.';
    const datos: DatosDescarguio = {
        fecha, modalidad: modalidad as DatosDescarguio['modalidad'], id_productor: id('id_productor'), id_producto: id('id_producto'),
        id_compra_detalle: id('id_compra_detalle'), id_recepcion_compra: id('id_recepcion_compra'), id_campana: id('id_campana'),
        boleta: txt('boleta', 80), chofer: txt('chofer', 150), placa: txt('placa', 30), procedencia: txt('procedencia', 200), localidad: txt('localidad', 200),
        variedad: txt('variedad', 100), cantidad: decimal('cantidad', 3, 999999999.999, false), unidad: txt('unidad', 30),
        humedad_entrada: decimal('humedad_entrada', 2, 100), impurezas_entrada: decimal('impurezas_entrada', 2, 100), impurezas_salida: decimal('impurezas_salida', 2, 100),
        peso_real_kg: decimal('peso_real_kg', 3, 999999999.999), id_ubicacion: id('id_ubicacion'), punto_descarga: txt('punto_descarga', 150),
        ubicacion_detalle: txt('ubicacion_detalle', 200), responsable: txt('responsable', 150), observacion: txt('observacion', 5000)
    };
    if (datos.unidad) {
        datos.unidad = normalizarUnidadMedida(datos.unidad);
        if (!esUnidadMedidaValida(datos.unidad)) campos.unidad = 'Seleccione Fanega, Quintal, Kilo o Unidad.';
    }
    if (datos.modalidad === 'SERVICIO' && (datos.id_compra_detalle || datos.id_recepcion_compra)) campos.id_compra_detalle = 'Un servicio a terceros no se vincula con una compra.';
    if (datos.id_recepcion_compra && !datos.id_compra_detalle) campos.id_compra_detalle = 'Seleccione la compra correspondiente a la recepción.';
    if (confirmar) {
        for (const campo of ['id_productor', 'id_producto', 'boleta', 'variedad', 'cantidad', 'unidad'] as const) if (!datos[campo]) campos[campo] = 'Este campo es obligatorio para confirmar.';
        if (datos.modalidad === 'COMPRA' && !datos.id_compra_detalle) campos.id_compra_detalle = 'Vincule una línea de compra que ya tenga arroz recibido.';
    }
    if (Object.keys(campos).length) throw new ErrorDescarguio('Revise los campos señalados.', 400, campos);
    return datos;
}
