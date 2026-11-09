import { valoresFiltro, idsFiltro } from '../utils/filtros-multiples-produccion';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { Response } from 'express';
import { Transaction } from 'sequelize';
import { datosEmpresa, EmpresaDatos, rutaLogotipo } from '../utils/empresa';
import { filasDescarguios } from './descarguios-consulta.servicio';
import { filasEtapa } from './produccion-etapas-consulta.servicio';
import { filasTransformacion } from './produccion-transformaciones-consulta.servicio';

import { leerDesc } from './descarguios.servicio';

type Fila = Record<string, any>;
type Valor = string | number | Date | null;
export const controlesOriginales = ['descarguios','secados','guardados','procesados'];
const titulos: Record<string,string> = { descarguios:'CONTROL DE DESCARGUÍO', secados:'CONTROL DE SECADO DE ARROZ', guardados:'CONTROL DE GUARDADO DE ARROZ', procesados:'CONTROL DE PROCESADO DE ARROZ' };
const archivos: Record<string,string> = { descarguios:'Control_Descarguio.xlsx',secados:'Control_Secado_Arroz.xlsx',guardados:'Control_Guardado_Arroz.xlsx',procesados:'Control_Procesado_Arroz.xlsx' };
export const columnasOriginales: Record<string,string[]> = {
 descarguios:['COD.','FECHA','BOLETA','PLACA','CHOFER','PRODUCTOR','ORIGEN','Variedad','PESO','SILO','%HE','%Ie','%Is.','OBSERVACIONES'],
 secados:['SEC.','Des.','FECHA','OP.','SIL','SEC','H.I.','% he','H.F.','% hs','VAR.','PRODUCTOR','N° Boleta','PESO (FG)','Proc.','Ubicación','OBSERVACIONES'],
 guardados:['COD.','Sec.','Desc.','Fecha','O','Productor','Variedad','N° Boleta','Peso/Fg','%He','%Hs.','%Ie.','%Is','Ubicación','F. Proc.','Detalle','Obs.'],
 procesados:['Cod.','Sec.','Desc.','Variedad','Productor','Boleta','Peso','F. Proc.','Arroz','3/4','Granillo','Rech.','Total','Rend.','Obs.']
};
export interface ControlOriginal { tipo:string; filas:Valor[][]; detalle:Valor[][]; columnasDetalle:string[]; totales:Valor[][]; filtros:{label:string;valor:string}[]; notas:string[]; }
const num = (v:any):number|null => v==null||v===''?null:Number.isFinite(Number(v))?Number(v):null;
function dia(v:any):Date|null { if(!v)return null;const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/La_Paz',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(v));const get=(k:string)=>Number(p.find(x=>x.type===k)?.value);return new Date(Date.UTC(get('year'),get('month')-1,get('day'))); }
function hora(v:any):number|null { if(!v)return null;const p=new Intl.DateTimeFormat('en-GB',{timeZone:'America/La_Paz',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(v));return (Number(p.find(x=>x.type==='hour')?.value)*60+Number(p.find(x=>x.type==='minute')?.value))/1440; }
const unicos=(rows:Fila[],key:string)=>[...new Set(rows.map(r=>r[key]).filter(v=>v!=null&&v!==''))].join('\n');
const medicion=(rows:Fila[],key:string):Valor=>{const v=[...new Set(rows.map(r=>r[key]).filter(v=>v!=null&&v!==''))];return v.length===1?num(v[0]):v.join('\n')||null;};
const normal=(s:any)=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function grupo(d:Fila) { const s=normal(d.clasificacion||d.producto);return /rech|descarte/.test(s)?'rechazo':/granillo/.test(s)?'granillo':/3\s*\/\s*4|¾/.test(s)?'tresCuartos':/entero/.test(s)?'entero':'otros'; }
function cantidades(ds:Fila[]):Valor {if(!ds.length)return null;const m=new Map<string,number>();for(const d of ds)m.set(d.unidad,(m.get(d.unidad)||0)+Number(d.cantidad));return m.size===1?[...m.values()][0]:[...m].map(([u,n])=>`${n} ${u}`).join('\n');}

/** Pure projection, also used by isolated export checks. No stock/financial writes. */
export function proyectarControl(tipo:string,rows:Fila[],origins:Fila[],ancestors:Fila[],filtros:ControlOriginal['filtros']):ControlOriginal {
 const out:ControlOriginal={tipo,filas:[],detalle:[],columnasDetalle:['Operación','Estado','Modalidad','Propietario','Unidad de entrada','Cantidad de entrada','Lote de origen','Cantidad de origen','Boleta(s)','Producto obtenido','Clasificación','Cantidad obtenida','Unidad obtenida','Peso real (kg)','Inicio (fecha)','Inicio (hora)','Fin (fecha)','Fin (hora)','Duración (min)','Información complementaria'],totales:[],filtros,notas:[]};
 const total=new Map<string,number>();
 const add=(label:string,unit:string,qty:any)=>{if(num(qty)!=null){const k=label+' / '+unit;total.set(k,(total.get(k)||0)+Math.round(Number(qty)*1000));}};
 for(const r of rows){
  const os=origins.filter(e=>Number(e.id_operacion)===Number(r.id));
  const as=ancestors.filter(a=>os.some(e=>Number(e.id)===Number(a.raiz)));
  const propietario=r.modalidad==='COMPRA'?'Ingenio (propio)':r.productor||'';
  const detail=(e:Fila={},d:Fila={})=>out.detalle.push([r.codigo,r.estado,r.modalidad,propietario,r.unidad||null,num(r.cantidad),e.lote||null,num(e.cantidad),unicos(as,'boleta')||r.boleta||null,d.producto||null,d.clasificacion||null,num(d.cantidad),d.unidad||null,num(d.peso_real_kg??r.peso_real_kg),dia(r.inicio),hora(r.inicio),dia(r.fin),hora(r.fin),num(r.duracion),[r.observacion,r.ubicacion_detalle,r.responsable,r.condicion,r.localidad,r.peso_salida!=null?`Salida medida: ${r.peso_salida} ${r.unidad_peso_salida}`:null,r.merma_medida!=null?`Merma: ${r.merma_medida} ${r.unidad_merma}; ${r.justificacion_merma||''}`:null].filter(Boolean).join('\n')]);
  if(r.estado==='CONFIRMADO')add('Entrada confirmada',r.unidad||'Sin unidad',r.cantidad);
  if(tipo==='descarguios'){
   out.filas.push([r.codigo,dia(r.fecha),r.boleta,r.placa,r.chofer,r.productor,r.procedencia,r.variedad,num(r.cantidad),r.ubicacion,num(r.humedad_entrada),num(r.impurezas_entrada),num(r.impurezas_salida),r.observacion]);detail();
  }else if(tipo==='secados'||tipo==='guardados'){
   for(const e of os.length?os:[{}]){
    const a=ancestors.filter(x=>Number(x.raiz)===Number(e.id)),s=a.filter(x=>x.tipo==='SECADO'),d=a.filter(x=>x.tipo==='DESCARGUIO');
    const qty=num(e.cantidad??r.cantidad);
    if(tipo==='secados')out.filas.push([r.codigo,unicos(d,'codigo'),dia(r.fecha),r.operador||r.responsable,r.silo,r.secadora,hora(r.inicio),num(r.humedad_entrada),hora(r.fin),num(r.humedad_salida),r.variedad,r.productor,unicos(d,'boleta'),qty,r.proc||null,[...new Set([r.ubicacion,r.ubicacion_detalle].filter(Boolean))].join(' / '),r.observacion]);
    else out.filas.push([r.codigo,unicos(s,'codigo'),unicos(d,'codigo'),dia(r.fecha),r.orden_guardado||null,r.productor,r.variedad,unicos(d,'boleta'),qty,medicion(s,'humedad_entrada'),medicion(s,'humedad_salida'),medicion(d,'impurezas_entrada'),medicion(d,'impurezas_salida'),[...new Set([r.ubicacion,r.ubicacion_detalle].filter(Boolean))].join(' / '),e.fechas_proceso||null,r.condicion||null,r.observacion]);
    detail(e);
   }
  }else{
   const resultados:Fila[]=r.resultados||[],units=new Set(resultados.map(d=>d.unidad));
   const porGrupo=(g:string):Valor=>{const ds=resultados.filter(d=>grupo(d)===g);if(units.size<=1)return cantidades(ds);const m=new Map<string,number>();for(const d of ds)m.set(d.unidad,(m.get(d.unidad)||0)+Number(d.cantidad));return [...m].map(([u,n])=>`${n} ${u}`).join('\n')||null;};
   out.filas.push([r.codigo,unicos(as.filter(a=>a.tipo==='SECADO'),'codigo'),unicos(as.filter(a=>a.tipo==='DESCARGUIO'),'codigo'),r.variedad,r.productor,unicos(as,'boleta'),num(r.cantidad),dia(r.fecha),porGrupo('entero'),porGrupo('tresCuartos'),porGrupo('granillo'),porGrupo('rechazo'),cantidades(resultados),num(r.resumen?.rendimiento),r.observacion]);
   for(const e of os)detail(e);
   for(const d of resultados){detail({},d);if(r.estado==='CONFIRMADO')add('Producción confirmada',d.unidad,d.cantidad);}
  }
 }
 out.totales=[...total].map(([k,v])=>[k,v/1000]);
 if(tipo==='guardados')out.notas.push('O: valor registrado en el formulario de Guardado. F. Proc.: fechas de procesos confirmados vinculados al lote resultante.');
 if(tipo==='secados')out.notas.push('Proc.: valor registrado en el formulario de Secado. H.I./H.F.: horas de inicio y fin del secado.');
 if(tipo==='procesados')out.notas.push('Arroz corresponde a clasificación Entero. Rend.: porcentaje con pesos comparables; no reproduce la razón QQ/Fg de la foto. El total incluye los productos obtenidos, separados por unidad.');
 out.notas.push('PESO/Peso/Fg: cantidad registrada en su unidad original. Totales: solo documentos confirmados, separados por unidad. Códigos conservados tal como están registrados.');
 return out;
}

export async function datosControlOriginal(tipo:string,q:Fila,t?:Transaction):Promise<ControlOriginal>{
 if(!controlesOriginales.includes(tipo))throw new Error('Control no admitido.');
 const query={...q,orden:'fecha',limit:10,offset:0},rows=tipo==='descarguios'?await filasDescarguios(query,true,t):tipo==='procesados'?await filasTransformacion('PROCESADO',query,true,t):await filasEtapa(tipo==='secados'?'SECADO':'GUARDADO',query,true,t);
 const ids=rows.map(r=>r.id);let origins:Fila[]=[],ancestors:Fila[]=[];
 if(ids.length&&tipo!=='descarguios'){
  origins=await leerDesc(`SELECT e.*,l.codigo lote FROM produccion_etapa_origenes e JOIN produccion_lotes l ON l.id=e.id_lote WHERE e.id_operacion IN (:ids) ORDER BY e.id_operacion,e.id`,{ids},t);
  ancestors=await leerDesc(`WITH RECURSIVE anc(raiz,id_lote) AS (
   SELECT e.id,e.id_lote FROM produccion_etapa_origenes e WHERE e.id_operacion IN (:ids)
   UNION DISTINCT SELECT a.raiz,e.id_lote FROM anc a JOIN produccion_lotes l ON l.id=a.id_lote JOIN produccion_etapa_origenes e ON e.id_operacion=l.id_operacion_origen
  ) SELECT a.raiz,o.id,o.codigo,o.tipo,d.boleta,d.impurezas_entrada,d.impurezas_salida,s.humedad_entrada,s.humedad_salida
  FROM anc a JOIN produccion_lotes l ON l.id=a.id_lote JOIN produccion_operaciones o ON o.id=l.id_operacion_origen
  LEFT JOIN produccion_descarguios d ON d.id_operacion=o.id LEFT JOIN produccion_secados s ON s.id_operacion=o.id ORDER BY a.raiz,o.fecha,o.id`,{ids},t);
  if(tipo==='secados'){
   const extra=await leerDesc(`SELECT id_operacion,inicio,fin,peso_salida,unidad_peso_salida,merma_medida,unidad_merma,justificacion_merma FROM produccion_secados WHERE id_operacion IN (:ids)`,{ids},t);
   for(const r of rows)Object.assign(r,extra.find(e=>Number(e.id_operacion)===Number(r.id))||{});
  }
  if(tipo==='guardados'){
   const dates=await leerDesc(`WITH RECURSIVE descend(raiz,id_lote) AS (
    SELECT e.id,e.id_lote_resultado FROM produccion_etapa_origenes e WHERE e.id_operacion IN (:ids) AND e.id_lote_resultado IS NOT NULL
    UNION DISTINCT SELECT d.raiz,e.id_lote_resultado FROM descend d JOIN produccion_etapa_origenes e ON e.id_lote=d.id_lote JOIN produccion_operaciones o ON o.id=e.id_operacion WHERE o.estado='CONFIRMADO' AND e.id_lote_resultado IS NOT NULL
   ) SELECT DISTINCT d.raiz,o.fecha FROM descend d JOIN produccion_etapa_origenes e ON e.id_lote=d.id_lote JOIN produccion_operaciones o ON o.id=e.id_operacion WHERE o.tipo='PROCESADO' AND o.estado='CONFIRMADO' ORDER BY o.fecha`,{ids},t);
   for(const e of origins)e.fechas_proceso=[...new Set(dates.filter(d=>Number(d.raiz)===Number(e.id)).map(d=>dia(d.fecha)!.toISOString().slice(0,10)))].join('\n');
  }
 }
 // Filters are validated by existing read-only queries; labels are administrative.
 const labels:Record<string,string>={fecha_desde:'Desde',fecha_hasta:'Hasta',modalidad:'Modalidad',variedad:'Variedad',estado:'Estado',secadora:'Secadora',ubicacion:'Ubicación',id_producto:'Producto (ID)',buscar:'Búsqueda',q:'Búsqueda'};
 const filtros=Object.entries(labels).filter(([k])=>q[k]!=null && q[k]!=='').map(([k,label])=>({label,valor:String(q[k])}));
 if(q.id_productor){const productores=await leerDesc('SELECT nombre FROM proveedores WHERE id IN (:id)',{id:idsFiltro(q.id_productor)},t); const p={nombre:productores.map(p=>p.nombre).join(', ')};filtros.push({label:'Productor',valor:p?.nombre||'Sin coincidencias'});}
 return proyectarControl(tipo,rows,origins,ancestors,filtros);
}

function dimensionesLogo(filename:string):{width:number;height:number}{
 const b=fs.readFileSync(filename);let w=1,h=1;
 if(b.toString('ascii',1,4)==='PNG'){w=b.readUInt32BE(16);h=b.readUInt32BE(20);}
 else if(b.toString('ascii',0,3)==='GIF'){w=b.readUInt16LE(6);h=b.readUInt16LE(8);}
 else if(b[0]===255&&b[1]===216){let p=2;while(p+9<b.length){if(b[p]!==255){p++;continue;}const marker=b[p+1];if(marker===218||marker===217)break;if(marker===216||marker===1||marker>=208&&marker<=215){p+=2;continue;}const len=b.readUInt16BE(p+2);if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){h=b.readUInt16BE(p+5);w=b.readUInt16BE(p+7);break;}if(len<2)break;p+=len+2;}}
 const scale=Math.min(105/w,55/h);return {width:w*scale,height:h*scale};
}
const nombresHojaControl:Record<string,string>={descarguios:'Descarguíos',secados:'Secados',guardados:'Guardados',procesados:'Procesados'};

export function agregarHojaControl(wb:ExcelJS.Workbook,data:ControlOriginal,empresa:EmpresaDatos=datosEmpresa(),nombreHoja?:string):ExcelJS.Worksheet{
 const esDesc=data.tipo==='descarguios';
 const name=(nombreHoja||nombresHojaControl[data.tipo]||'Control').slice(0,31);
 const headers=columnasOriginales[data.tipo];
 const values=data.filas;
 const principal=true;
  // Carta (1) horizontal para todos los controles de producción.
  const ws=wb.addWorksheet(name,{pageSetup:{paperSize:1,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,margins:{left:.25,right:.25,top:.3,bottom:.35,header:.12,footer:.15}},views:[{state:'frozen',ySplit:7,showGridLines:false}]});
  const end=headers.length;
  const logo=rutaLogotipo(),extension=logo?path.extname(logo).slice(1).toLowerCase():'';
  const ahora=new Date();
  const fechaGen=new Intl.DateTimeFormat('es-BO',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'America/La_Paz'}).format(ahora);
  const horaGen=new Intl.DateTimeFormat('es-BO',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZone:'America/La_Paz'}).format(ahora);
  const gestion=[...new Set(data.filas.flatMap(row=>row.filter(v=>v instanceof Date).map(v=>(v as Date).getUTCFullYear())))].join(', ')||'Sin registros';

  let headerRow=3;
  if(esDesc&&principal){
   // Fila 1: logo + datos empresa | meta
   ws.getRow(1).height=52;
   if(logo&&['png','jpg','jpeg','gif'].includes(extension)){
    const image=wb.addImage({filename:logo,extension:(extension==='jpg'?'jpeg':extension) as 'png'|'jpeg'|'gif'});
    ws.addImage(image,{tl:{col:0,row:0},ext:{width:44,height:44}});
   }
   ws.mergeCells(1,2,1,6);
   const lineasEmpresa=[empresa.nombre.toUpperCase(),empresa.slogan||'Sistema de Gestión Administrativa',[empresa.telefono?`Teléfono: ${empresa.telefono}`:'',empresa.ciudad].filter(Boolean).join(' · ')].filter(Boolean);
   ws.getCell(1,2).value=lineasEmpresa.join('\n');
   ws.getCell(1,2).font={name:'Arial',size:9,bold:true};ws.getCell(1,2).alignment={vertical:'middle',wrapText:true,horizontal:'left'};
   ws.mergeCells(1,end-2,1,end);
   ws.getCell(1,end-2).value=`Gestión ${gestion}\nGenerado: ${fechaGen}\nHora: ${horaGen}`;
   ws.getCell(1,end-2).font={name:'Arial',size:9,bold:true};ws.getCell(1,end-2).alignment={vertical:'middle',horizontal:'right',wrapText:true};
   // Fila 2: título centrado
   ws.mergeCells(2,1,2,end);ws.getRow(2).height=28;
   ws.getCell(2,1).value=titulos[data.tipo];ws.getCell(2,1).font={name:'Arial',size:13,bold:true,underline:true};ws.getCell(2,1).alignment={horizontal:'center',vertical:'middle'};
   // Fila 3: filtros
   ws.mergeCells(3,1,3,end);ws.getRow(3).height=22;
   ws.getCell(3,1).value=data.filtros.map(f=>`${f.label}: ${f.valor}`).join('   |   ')||'Todos los registros';
   ws.getCell(3,1).font={name:'Arial',size:9};ws.getCell(3,1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFEDEDED'}};ws.getCell(3,1).alignment={vertical:'middle',wrapText:true};
   // Fila 4: grupos / Fila 5: columnas
   const groups=[['RECEPCIÓN',1,3],['DATOS DEL CAMIÓN',4,5],['DATOS DEL CLIENTE',6,7],['ARROZ',8,9],['ALMACENAJE',10,13]];
   for(const [label,a,b]of groups){ws.mergeCells(4,Number(a),4,Number(b));ws.getCell(4,Number(a)).value=String(label);}
   headerRow=5;ws.getRow(headerRow).values=headers;ws.getRow(headerRow).height=22;
   for(const n of [4,5])ws.getRow(n).eachCell({includeEmpty:true},cell=>{cell.font={name:'Arial',bold:true,size:9};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFE8E8E8'}};cell.alignment={wrapText:true,vertical:'middle',horizontal:'center'};cell.border={top:{style:'thin',color:{argb:'FF555555'}},bottom:{style:'thin',color:{argb:'FF555555'}},left:{style:'thin',color:{argb:'FF555555'}},right:{style:'thin',color:{argb:'FF555555'}}};});
  }else{
   ws.mergeCells(1,1,1,3);ws.getRow(1).height=58;
   if(logo&&['png','jpg','jpeg','gif'].includes(extension)){
    const image=wb.addImage({filename:logo,extension:(extension==='jpg'?'jpeg':extension) as 'png'|'jpeg'|'gif'});
    ws.addImage(image,{tl:{col:0,row:0},ext:dimensionesLogo(logo)});
    ws.getCell(1,1).value=empresa.nombre;ws.getCell(1,1).alignment={vertical:'bottom',horizontal:'right',wrapText:true};ws.getCell(1,1).font={name:'Arial',size:9};
   }else{ws.getCell(1,1).value=empresa.nombre;ws.getCell(1,1).font={name:'Arial',size:14,bold:true};ws.getCell(1,1).alignment={vertical:'middle',wrapText:true};}
   ws.mergeCells(1,4,1,end-2);ws.getCell(1,4).value=titulos[data.tipo];ws.getCell(1,4).font={name:'Arial',size:12,bold:true,underline:true};ws.getCell(1,4).alignment={horizontal:'center',vertical:'middle',wrapText:true};
   ws.mergeCells(1,end-1,1,end);ws.getCell(1,end-1).value='GESTIÓN '+gestion;ws.getCell(1,end-1).font={name:'Arial',size:8,bold:true};ws.getCell(1,end-1).alignment={vertical:'middle',horizontal:'center',wrapText:true};
   ws.mergeCells(2,1,2,end);ws.getCell(2,1).value=data.filtros.map(f=>`${f.label}: ${f.valor}`).join(' · ')||'Consulta: todos los registros (sin filtros adicionales).';ws.getCell(2,1).font={name:'Arial',size:8};ws.getCell(2,1).alignment={wrapText:true,vertical:'middle'};ws.getRow(2).height=Math.max(20,Math.ceil(String(ws.getCell(2,1).value).length/190)*12);
   headerRow=3;ws.getRow(headerRow).values=headers;ws.getRow(headerRow).height=22;
   ws.getRow(3).eachCell({includeEmpty:true},cell=>{cell.font={name:'Arial',bold:true,size:7.5};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFE9ECEF'}};cell.alignment={wrapText:true,vertical:'middle',horizontal:'center'};cell.border={bottom:{style:'thin'},top:{style:'thin'}};});
  }

  ws.views=[{state:'frozen',ySplit:headerRow,showGridLines:false}];
  if(esDesc&&principal){
   const anchos=[9,10,10,9,13,15,10,9,8,7,7,7,7,14];
   headers.forEach((_,i)=>{ws.getColumn(i+1).width=anchos[i]||10;});
  }else{
   headers.forEach((h,i)=>{ws.getColumn(i+1).width=/observ|informaci|productor|propietario|producto obtenido|chofer/i.test(h)?16:/boleta|detalle|ubicaci/i.test(h)?12:/fecha|c[oó]d|secado|descarg|operaci|lote|^sec\.|^des\.|^desc\./i.test(h)?10:8;});
  }
  const dateCols=principal?(data.tipo==='descarguios'?[2]:data.tipo==='secados'?[3]:data.tipo==='guardados'?[4]:[8]):[15,17];
  const timeCols=principal&&data.tipo==='secados'?[7,9]:principal?[]:[16,18];
  const fontTabla=esDesc?8:7.5;
  values.forEach(v=>{const row=ws.addRow(v.map(x=>x==null||x===''?null:x));let lines=1;row.eachCell({includeEmpty:true},(cell,c)=>{
   cell.font={name:'Arial',size:fontTabla};cell.alignment={vertical:'middle',wrapText:true,horizontal:typeof cell.value==='number'?'right':'left'};
   cell.border={top:{style:'thin',color:{argb:'FF555555'}},bottom:{style:'thin',color:{argb:'FF555555'}},left:{style:'thin',color:{argb:'FF555555'}},right:{style:'thin',color:{argb:'FF555555'}}};
   cell.numFmt=dateCols.includes(c)?'dd-mmm-yyyy':timeCols.includes(c)?'hh:mm':'#,##0.00#';
   lines=Math.max(lines,...String(cell.value instanceof Date?'fecha':cell.value??'').split('\n').map(s=>Math.ceil(s.length*1.15/Math.max(6,(ws.getColumn(c).width||10)-1))));
  });row.height=Math.max(esDesc?16:15,lines*(esDesc?11:10)+4);});
  ws.autoFilter={from:{row:headerRow,column:1},to:{row:Math.max(headerRow,headerRow+values.length),column:end}};
  ws.pageSetup.printTitlesRow='1:'+headerRow;if(!principal)ws.pageSetup.printTitlesColumn='A:A';
  if(principal){
   for(const total of data.totales){
    const n=ws.addRow([]).number;
    if(esDesc){
     // Etiqueta a la izquierda; valor bajo columna PESO (9)
     ws.mergeCells(n,1,n,8);ws.getCell(n,1).value=total[0];ws.getCell(n,1).font={name:'Arial',size:8,bold:true};ws.getCell(n,1).alignment={vertical:'middle'};
     ws.getCell(n,9).value=total[1];ws.getCell(n,9).numFmt='#,##0.00#';ws.getCell(n,9).font={name:'Arial',size:8,bold:true};ws.getCell(n,9).alignment={horizontal:'right',vertical:'middle'};
     for(let c=1;c<=end;c++){ws.getCell(n,c).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFE8E8E8'}};ws.getCell(n,c).border={top:{style:'thin',color:{argb:'FF555555'}},bottom:{style:'thin',color:{argb:'FF555555'}},left:{style:'thin',color:{argb:'FF555555'}},right:{style:'thin',color:{argb:'FF555555'}}};}
    }else{
     ws.mergeCells(n,1,n,6);ws.getCell(n,1).value=total[0];ws.getCell(n,7).value=total[1];ws.getCell(n,7).numFmt='#,##0.00#';ws.getRow(n).font={name:'Arial',size:8,bold:true};
    }
    ws.getRow(n).height=18;
   }
   for(const note of data.notas){const n=ws.addRow([]).number;ws.mergeCells(n,1,n,end);ws.getCell(n,1).value=note;ws.getCell(n,1).font={name:'Arial',size:7,italic:true};ws.getCell(n,1).alignment={wrapText:true};ws.getRow(n).height=Math.max(18,Math.ceil(note.length/180)*10);}
  }
  ws.pageSetup.printArea=`A1:${ws.getColumn(end).letter}${ws.rowCount}`;
  ws.headerFooter.oddFooter='&RPágina &P de &N';
  return ws;
}
export function libroControlOriginal(data:ControlOriginal,empresa:EmpresaDatos=datosEmpresa()):ExcelJS.Workbook{
 const wb=new ExcelJS.Workbook();wb.creator=empresa.nombre;wb.created=new Date();
 agregarHojaControl(wb,data,empresa,'Control original');
 return wb;
}
export async function enviarControlOriginal(res:Response,tipo:string,q:Fila):Promise<void>{
 const data=await datosControlOriginal(tipo,q),wb=libroControlOriginal(data);
 const buffer=await wb.xlsx.writeBuffer();
 res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.setHeader('Access-Control-Expose-Headers','Content-Disposition');res.setHeader('Content-Disposition',`attachment; filename="${archivos[tipo]}"`);res.send(Buffer.from(buffer));
}
export async function enviarControlConsolidadoExcel(res:Response,q:Fila,tipos:string[]):Promise<void>{
 const empresa=datosEmpresa(),wb=new ExcelJS.Workbook();wb.creator=empresa.nombre;wb.created=new Date();
 const usados=new Set<string>();
 for(const tipo of tipos){
  if(!controlesOriginales.includes(tipo))continue;
  const data=await datosControlOriginal(tipo,q);
  let nombre=nombresHojaControl[tipo]||tipo;
  if(usados.has(nombre))nombre=`${nombre} (${tipo})`;
  usados.add(nombre);
  agregarHojaControl(wb,data,empresa,nombre);
 }
 if(tipos.includes('envasados')){
  const {hojaTransformacion}=await import('./produccion-transformaciones-consulta.servicio');
  const hoja=await hojaTransformacion('ENVASADO',{...q,orden:'fecha',direccion:-1},'xlsx');
  const ws=wb.addWorksheet('Envasados',{pageSetup:{paperSize:1,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,margins:{left:.25,right:.25,top:.3,bottom:.35,header:.12,footer:.15}}});
  const cols=['N°',...hoja.columnas];
  ws.addRow([empresa.nombre.toUpperCase(),'','CONTROL DE ENVASADOS DE ARROZ']).font={name:'Arial',size:11,bold:true};
  ws.mergeCells(1,1,1,Math.max(3,cols.length));
  ws.addRow([hoja.consulta?.map(f=>`${f.label}: ${f.valor}`).join(' | ')||'Todos los registros']);
  ws.mergeCells(2,1,2,cols.length);
  const header=ws.addRow(cols);header.font={name:'Arial',bold:true,size:7.5};header.eachCell(c=>{c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFE9ECEF'}};c.border={top:{style:'thin'},bottom:{style:'thin'},left:{style:'thin'},right:{style:'thin'}};} );
  hoja.filas.forEach((fila,i)=>{
   const row=ws.addRow([i+1,...fila.map(v=>v==null||v===''?null:v)]);
   row.eachCell(c=>{c.font={name:'Arial',size:7.5};c.border={top:{style:'thin'},bottom:{style:'thin'},left:{style:'thin'},right:{style:'thin'}};c.alignment={wrapText:true,vertical:'middle'};});
  });
  cols.forEach((h,i)=>{ws.getColumn(i+1).width=/productor|propietario|producto|observ/i.test(h)?16:/código|fecha|ubicaci/i.test(h)?11:9;});
 }
 if(!wb.worksheets.length)throw new Error('No hay módulos de producción para consolidar.');
 const buffer=await wb.xlsx.writeBuffer();
 res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
 res.setHeader('Access-Control-Expose-Headers','Content-Disposition');
 res.setHeader('Content-Disposition','attachment; filename="Control_Produccion_Consolidado.xlsx"');
 res.send(Buffer.from(buffer));
}
