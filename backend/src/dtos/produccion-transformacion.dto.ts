import { validarEtapa, FilaEtapa as Fila } from './produccion-etapa.dto';
import { ErrorDescarguio } from './descarguio.dto';
export type Transformacion='PROCESADO'|'ENVASADO';
export function validarTransformacion(tipo:Transformacion,raw:Fila,confirmar=false):Fila {
    const d=validarEtapa('GUARDADO',raw,false),errors:Record<string,string>={};delete d.condicion;
    const text=(c:string,max=150,value:unknown=raw[c])=>{if(value==null||value==='')return null;if(typeof value!=='string'||value.trim().length>max){errors[c]=`Hasta ${max} caracteres.`;return null;}return value.trim()||null;};
    const number=(c:string,value:unknown=raw[c],decimals=3,positive=false,max=999999999.999)=>{if(value==null||value==='')return null;if(!['string','number'].includes(typeof value)||!new RegExp(decimals ? `^\\d+(?:\\.\\d{1,${decimals}})?$` : '^\\d+$').test(String(value))||!Number.isFinite(Number(value))||Number(value)>max||(positive&&Number(value)<=0)){errors[c]=`Ingrese ${positive?'un valor mayor que cero':'un valor no negativo'}, hasta ${decimals} decimales.`;return null;}return Number(value);};
    const id=(c:string,value:unknown=raw[c])=>number(c,value,0,true,2147483647);
    if(confirmar&&(!d.origenes.length||d.origenes.some((r:Fila)=>!r.cantidad)))errors.origenes='Seleccione lotes y cantidades mayores que cero.';
    if(tipo==='PROCESADO'){
        Object.assign(d,{maquina:text('maquina'),peso_entrada_kg:number('peso_entrada_kg',raw.peso_entrada_kg,3,true),merma_medida:number('merma_medida'),unidad_merma:text('unidad_merma',30),justificacion_merma:text('justificacion_merma',2000)});
        if(d.merma_medida!=null&&(!['Fanega','Quintal','Kilo','Unidad'].includes(d.unidad_merma)||!d.justificacion_merma))errors.justificacion_merma='Indique unidad y justificación de la merma medida.';
        if(d.merma_medida==null&&d.unidad_merma)errors.merma_medida='Registre la medición o quite su unidad.';
        if(!Array.isArray(raw.resultados)||raw.resultados.length>30)errors.resultados='Registre hasta 30 productos obtenidos.';
        d.resultados=(Array.isArray(raw.resultados)?raw.resultados.slice(0,30):[]).map((r:Fila,i:number)=>({id_producto:id(`resultados.${i}.id_producto`,r?.id_producto),clasificacion:text(`resultados.${i}.clasificacion`,100,r?.clasificacion),cantidad:number(`resultados.${i}.cantidad`,r?.cantidad,3,true),unidad:text(`resultados.${i}.unidad`,30,r?.unidad),peso_real_kg:number(`resultados.${i}.peso_real_kg`,r?.peso_real_kg,3,true),observacion:text(`resultados.${i}.observacion`,2000,r?.observacion)}));
        if(confirmar&&(!d.resultados.length||d.resultados.some((r:Fila)=>!r.id_producto||!r.cantidad||!r.unidad||!r.clasificacion)))errors.resultados='Complete producto, clasificación, cantidad y unidad de cada resultado.';
    }else{
        if(d.origenes.length>1)errors.origenes='Cada envasado corresponde a un único lote procesado.';
        Object.assign(d,{id_producto_empaque:id('id_producto_empaque'),id_producto_destino:id('id_producto_destino'),presentacion:text('presentacion'),numero_bolsas:number('numero_bolsas',raw.numero_bolsas,0,true,10000000),contenido_bolsa_kg:number('contenido_bolsa_kg',raw.contenido_bolsa_kg,3,true),
            equivalencia_kg_origen:number('equivalencia_kg_origen',raw.equivalencia_kg_origen,6,true),equivalencia_kg_destino:number('equivalencia_kg_destino',raw.equivalencia_kg_destino,6,true),origen_equivalencia:text('origen_equivalencia',250)});
        if(confirmar)for(const c of ['id_producto_empaque','id_producto_destino','presentacion','numero_bolsas','contenido_bolsa_kg'])if(!d[c])errors[c]='Obligatorio para confirmar.';
    }
    if(Object.keys(errors).length)throw new ErrorDescarguio('Revise los campos señalados.',400,errors);return d;
}
