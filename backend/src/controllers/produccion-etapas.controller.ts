import { Request, Response } from 'express';
import { Etapa } from '../dtos/produccion-etapa.dto';
import { guardarEtapa, obtenerEtapa, confirmarEtapa, anularEtapa } from '../servicios/produccion-etapas.servicio';
import { listarEtapa, opcionesEtapa, hojaEtapa } from '../servicios/produccion-etapas-consulta.servicio';
import { responderErrorProduccion } from './produccion-base.controller';
import { getAuthUser } from '../utils/auth-user';
import { refrescarEmpresa } from '../utils/empresa';
import { enviarExcel, enviarPdf } from '../utils/exportar';
export function controladorEtapa(tipo: Etapa) {
    const wrap=(fn:(req:Request)=>Promise<unknown>,status=200)=>async(req:Request,res:Response)=>{
        try {res.status(status).json(await fn(req));} catch(e){responderErrorProduccion(res,e);}
    };
    return {
        listar:wrap(r=>listarEtapa(tipo,r.query)),obtener:wrap(r=>obtenerEtapa(tipo,r.params.id)),opciones:wrap(r=>opcionesEtapa(tipo,r.query)),
        crear:wrap(r=>guardarEtapa(tipo,null,r.body||{},getAuthUser(r)!.id),201),editar:wrap(r=>guardarEtapa(tipo,r.params.id,r.body||{},getAuthUser(r)!.id)),
        confirmar:wrap(r=>confirmarEtapa(tipo,r.params.id,r.body||{},getAuthUser(r)!.id)),anular:wrap(r=>anularEtapa(tipo,r.params.id,r.body||{},getAuthUser(r)!.id)),
        exportar:async(req:Request,res:Response)=>{try{await refrescarEmpresa();const formato=req.query.formato==='xlsx'?'xlsx':'pdf',hoja=await hojaEtapa(tipo,req.query,formato),nombre=tipo==='SECADO'?'control-secados':'control-guardados';
            if(formato==='xlsx') await enviarExcel(res,nombre,[hoja]);else enviarPdf(res,nombre,[hoja]);
        }catch(e){responderErrorProduccion(res,e);}}
    };
}
