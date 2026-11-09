import { ErrorDescarguio } from './descarguio.dto';
export type Etapa = 'SECADO' | 'GUARDADO';
export type FilaEtapa = Record<string, any>;
export function validarEtapa(tipo: Etapa, raw: FilaEtapa, confirmar = false): FilaEtapa {
    const campos: Record<string,string> = {};
    const text = (c: string, max = 150) => {
        if (raw[c] == null || raw[c] === '') return null;
        if (typeof raw[c] !== 'string' || raw[c].trim().length > max) { campos[c] = `Máximo ${max} caracteres.`; return null; }
        return raw[c].trim() || null;
    };
    const date = (c: string, required = false) => {
        if (raw[c] == null || raw[c] === '') { if (required) campos[c] = 'Fecha obligatoria.'; return null; }
        const v = raw[c] instanceof Date ? raw[c].toISOString() : raw[c];
        const d = new Date(v);
        if (typeof v !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(v) || !Number.isFinite(d.getTime()) || d.toISOString().slice(0,19) !== v.slice(0,19)) {
            campos[c] = 'Fecha y hora inválidas.'; return null;
        } return d;
    };
    const num = (value: unknown, c: string, decimals = 3, max = 999999999.999, positive = false) => {
        if (value == null || value === '') return null;
        if (!['number','string'].includes(typeof value) || !new RegExp(`^\\d+(?:\\.\\d{1,${decimals}})?$`).test(String(value)) || !Number.isFinite(Number(value)) || Number(value) > max || (positive && Number(value) <= 0)) {
            campos[c] = positive ? 'Cantidad mayor que cero, hasta 3 decimales.' : `Valor de 0 a ${max}, hasta ${decimals} decimales.`; return null;
        } return Number(value);
    };
    const id = (v: any, c: string) => {
        if (v == null || v === '') return null;
        if (!['string','number'].includes(typeof v) || !Number.isSafeInteger(Number(v)) || Number(v) <= 0 || Number(v) > 2147483647) { campos[c] = 'Identificador inválido.'; return null; }
        return Number(v);
    };
    const origins = raw.origenes == null ? [] : raw.origenes;
    if (!Array.isArray(origins) || origins.length > 20) campos.origenes = 'Seleccione hasta 20 lotes.';
    const origenes = (Array.isArray(origins) ? origins.slice(0,20) : []).map((o: any, i: number) => ({ id_lote: id(o?.id_lote, `origenes.${i}.id_lote`), cantidad: num(o?.cantidad, `origenes.${i}.cantidad`, 3, 999999999.999, true) }));
    if (new Set(origenes.map(o => o.id_lote)).size !== origenes.length) campos.origenes = 'No repita el mismo lote.';
    if (origenes.some(o => !o.id_lote)) campos.origenes = 'Seleccione un lote válido por línea.';
    if (confirmar && (!origenes.length || origenes.some(o => !o.cantidad))) campos.origenes = 'Seleccione el origen y una cantidad mayor que cero para cada lote.';
    const d: FilaEtapa = { fecha: date('fecha', true), origenes, responsable: text('responsable'), observacion: text('observacion',5000),
        id_ubicacion: id(raw.id_ubicacion,'id_ubicacion'), destino_nombre: text('destino_nombre'), ubicacion_detalle: text('ubicacion_detalle',200) };
    if (tipo === 'SECADO') {
        Object.assign(d, { proc: text('proc',50), secadora: text('secadora'), operador: text('operador'), silo: text('silo'), inicio: date('inicio'), fin: date('fin'),
            humedad_entrada: num(raw.humedad_entrada,'humedad_entrada',2,100), humedad_salida: num(raw.humedad_salida,'humedad_salida',2,100),
            peso_salida: num(raw.peso_salida,'peso_salida'), unidad_peso_salida: text('unidad_peso_salida',30), merma_medida: num(raw.merma_medida,'merma_medida'),
            unidad_merma: text('unidad_merma',30), justificacion_merma: text('justificacion_merma',2000) });
        if (d.fin && (!d.inicio || d.fin < d.inicio)) campos.fin = 'El fin debe ser posterior o igual al inicio, incluyendo el día correcto.';
        for (const [valor, unidad] of [['peso_salida','unidad_peso_salida'],['merma_medida','unidad_merma']]) {
            if (d[valor] != null && !['Fanega','Quintal','Kilo','Unidad'].includes(d[unidad])) campos[unidad] = 'Indique la unidad de la medición.';
            if (d[valor] == null && d[unidad]) campos[valor] = 'Registre la cantidad medida o quite su unidad.';
        }
        if (d.merma_medida != null && !d.justificacion_merma) campos.justificacion_merma = 'Explique cómo se midió o justificó la merma.';
        if (confirmar) for (const c of ['secadora','inicio','fin','humedad_salida']) if (d[c] == null || d[c] === '') campos[c] = 'Obligatorio para confirmar el ciclo.';
    } else {
        d.condicion = text('condicion');
        d.orden_guardado = text('orden_guardado',50);
        if (confirmar && !d.id_ubicacion && !d.destino_nombre) campos.destino_nombre = 'Seleccione o escriba el silo/almacén destino.';
    }
    if (Object.keys(campos).length) throw new ErrorDescarguio('Revise los campos señalados.',400,campos);
    return d;
}
