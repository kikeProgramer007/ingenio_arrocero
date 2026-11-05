import { Request,Response } from 'express';
import { consultarLotes,detalleLote,opcionesLotes,hojaLotes } from '../servicios/produccion-trazabilidad.servicio';
import { consultarReporteProduccion,hojaReporteProduccion } from '../servicios/produccion-reportes.servicio';
import { responderErrorProduccion } from './produccion-base.controller';
import { refrescarEmpresa } from '../utils/empresa';
import { enviarExcel,enviarPdf } from '../utils/exportar';
const envolver=(fn:(r:Request)=>Promise<unknown>)=>async(r:Request,s:Response)=>{try{s.json(await fn(r));}catch(e){responderErrorProduccion(s,e);}};
export const consultasProduccion={
 lotes:envolver(r=>consultarLotes(r.query)),lote:envolver(r=>detalleLote(r.params.id)),opciones:envolver(()=>opcionesLotes()),
 reporte:envolver(r=>consultarReporteProduccion(r.params.tipo,r.query)),
 exportar:async(r:Request,s:Response)=>{try{await refrescarEmpresa();const formato=r.query.formato==='xlsx'?'xlsx':'pdf';
  const hoja=r.params.tipo?await hojaReporteProduccion(r.params.tipo,r.query,formato):await hojaLotes(r.query,formato);
  hoja.cabeceraReporte=true;
  if(formato==='xlsx')await enviarExcel(s,'produccion-'+(r.params.tipo||'lotes'),[hoja]);else enviarPdf(s,'produccion-'+(r.params.tipo||'lotes'),[hoja]);
 }catch(e){responderErrorProduccion(s,e);}}
};
