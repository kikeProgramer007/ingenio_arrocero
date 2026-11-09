import { Transaction } from 'sequelize';
import { hojaDescarguios } from './descarguios-reporte.servicio';
import { hojaEtapa } from './produccion-etapas-consulta.servicio';
import { hojaTransformacion, filasTransformacion, listarTransformacion } from './produccion-transformaciones-consulta.servicio';
import { hojaLotes, numeroProduccion } from './produccion-trazabilidad.servicio';
import { aplicarPlantillaFormal, HojaExport } from '../utils/exportar';
import { filtrosProduccion, ErrorConsultaProduccion } from './produccion-consulta.servicio';

export const reportesProduccion:Record<string,{nombre:string;programa:string}>={
 descarguios:{nombre:'Control de descarguíos',programa:'descarguios'},secados:{nombre:'Control de secados',programa:'secados'},guardados:{nombre:'Control de guardados',programa:'guardados'},
 procesados:{nombre:'Control de procesados',programa:'procesados'},envasados:{nombre:'Control de envasados',programa:'envasados'},
 existencias:{nombre:'Existencias por productor',programa:'lotes'},rendimiento:{nombre:'Rendimiento de producción',programa:'procesados'}
};
export async function hojaReporteProduccion(tipo:string,q:Record<string,any>,formato:'pdf'|'xlsx',t?:Transaction):Promise<HojaExport>{
 if(!reportesProduccion[tipo])throw new ErrorConsultaProduccion('Reporte de producción inválido.',404);
 const query={...q,orden:'fecha',direccion:-1,offset:0,limit:10};let h:HojaExport;
 if(tipo==='descarguios')h=await hojaDescarguios(query,'xlsx',t);
 else if(tipo==='secados'||tipo==='guardados')h=await hojaEtapa(tipo==='secados'?'SECADO':'GUARDADO',query,'xlsx',t);
 else if(tipo==='procesados'||tipo==='envasados')h=await hojaTransformacion(tipo==='procesados'?'PROCESADO':'ENVASADO',query,'xlsx',t);
 else if(tipo==='existencias')h=await hojaLotes(query,'xlsx',true,t);
 else {
  const rows=await filasTransformacion('PROCESADO',query,true,t),summary=await listarTransformacion('PROCESADO',{...query,limit:1},t);
  const base=await hojaTransformacion('PROCESADO',{...query,limit:1},formato,t),n=(v:any)=>v==null?'No medido':Number(v);
  h=aplicarPlantillaFormal({nombre:'Rendimiento',titulo:'RENDIMIENTO DE PRODUCCIÓN',orientacion:'portrait',textoCompleto:true,mostrarTotalesAutomaticos:false,
   proporcionesColumnas:{'N°':20,Proceso:72,Fecha:52,Productor:145,Variedad:43,'Entrada medida (kg)':62,'Salida medida (kg)':62,'Rendimiento (%)':60,Estado:66},
   columnas:['Proceso','Fecha','Productor','Variedad','Entrada medida (kg)','Salida medida (kg)','Rendimiento (%)','Estado'],
   filas:rows.map(r=>[r.codigo,new Date(r.fecha).toLocaleDateString('es-BO',{timeZone:'America/La_Paz'}),r.productor||'No informado',r.variedad||'No informada',n(r.unidad==='Kilo'?r.cantidad:r.peso_entrada_kg),n(r.peso_salida_kg),n(r.resumen.rendimiento),r.estado]),
   resumen:[{label:'Operaciones',valor:rows.length},{label:'Rendimiento ponderado (%)',valor:numeroProduccion(summary.resumen.rendimiento)}],
   formatosNumericos:{'Entrada medida (kg)':'#,##0.###','Salida medida (kg)':'#,##0.###','Rendimiento (%)':'0.###'}},base.consulta);
  h.consulta!.push({label:'Cálculo',valor:'Salida medida / entrada medida × 100. Sin equivalencias implícitas. El ponderado incluye confirmados y exige mediciones completas.'});
 }
 const idx=q.columna==null?0:Number(q.columna);
 if(!Number.isSafeInteger(idx)||idx<0||idx>=h.columnas.length)throw new ErrorConsultaProduccion('Columna de orden inválida.');
 const comparable=(v:any)=>typeof v==='number'?v:typeof v==='string'&&/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v)?v.split('/').reverse().map((s:string)=>s.padStart(2,'0')).join('-'):String(v??'');
 const sign=String(q.direccion)==='1'?1:-1;
 h.filas.sort((a,b)=>{const x=comparable(a[idx]),y=comparable(b[idx]);return (typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),'es',{numeric:true}))*sign;});
 if(formato==='pdf')h.filas=h.filas.map(row=>row.map((v,j)=>typeof v==='number'&&j!==0?numeroProduccion(v):v));
 h.mostrarFirma=false;h.cabeceraReporte=true;return h;
}
// La pantalla, PDF y Excel consumen exactamente las mismas filas y resúmenes.
export async function consultarReporteProduccion(tipo:string,q:Record<string,any>,t?:Transaction){
 const f=filtrosProduccion({...q,tipo:undefined,orden:'fecha'},100),h=await hojaReporteProduccion(tipo,q,'xlsx',t),rows=h.filas.map((valores,i)=>({id:i+1,valores}));
 return {columnas:h.columnas,items:rows.slice(f.offset,f.offset+f.limit),total:rows.length,resumen:h.resumen||[],consulta:h.consulta||[]};
}
