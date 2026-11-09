import { enviarControlPdf } from '../servicios/produccion-controles-pdf.servicio';
import { enviarControlOriginal } from '../servicios/produccion-controles-excel.servicio';
import { Request, Response } from 'express';
import { Transformacion } from '../dtos/produccion-transformacion.dto';
import { guardarTransformacion, obtenerTransformacion, confirmarTransformacion, anularTransformacion } from '../servicios/produccion-transformaciones.servicio';
import { listarTransformacion, opcionesTransformacion, hojaTransformacion } from '../servicios/produccion-transformaciones-consulta.servicio';
import { responderErrorProduccion } from './produccion-base.controller';
import { getAuthUser } from '../utils/auth-user';
import { refrescarEmpresa } from '../utils/empresa';
import { enviarExcel, enviarPdf } from '../utils/exportar';
export function controladorTransformacion(tipo:Transformacion){
    const wrap=(fn:(r:Request)=>Promise<unknown>,status=200)=>async(req:Request,res:Response)=>{try{res.status(status).json(await fn(req));}catch(e){responderErrorProduccion(res,e);}};
    return {listar:wrap(r=>listarTransformacion(tipo,r.query)),obtener:wrap(r=>obtenerTransformacion(tipo,r.params.id)),opciones:wrap(r=>opcionesTransformacion(tipo,r.query)),
        crear:wrap(r=>guardarTransformacion(tipo,null,r.body||{},getAuthUser(r)!.id),201),editar:wrap(r=>guardarTransformacion(tipo,r.params.id,r.body||{},getAuthUser(r)!.id)),confirmar:wrap(r=>confirmarTransformacion(tipo,r.params.id,r.body||{},getAuthUser(r)!.id)),anular:wrap(r=>anularTransformacion(tipo,r.params.id,r.body||{},getAuthUser(r)!.id)),
        exportar:async(req:Request,res:Response)=>{try{await refrescarEmpresa();if(tipo==='PROCESADO')return req.query.formato==='xlsx'?await enviarControlOriginal(res,'procesados',req.query):await enviarControlPdf(res,'procesados',req.query);const formato=req.query.formato==='xlsx'?'xlsx':'pdf',hoja=await hojaTransformacion(tipo,req.query,formato),nombre='control-envasados';if(formato==='xlsx')await enviarExcel(res,nombre,[hoja]);else enviarPdf(res,nombre,[hoja]);}catch(e){responderErrorProduccion(res,e);}}
    };
}
