import { enviarControlPdf } from '../servicios/produccion-controles-pdf.servicio';
import { enviarControlOriginal } from '../servicios/produccion-controles-excel.servicio';
import { enviarBoletaSecadoPdf } from '../servicios/secado-boleta-pdf.servicio';
import { Request, Response } from 'express';
import { User } from '../models';
import { Etapa } from '../dtos/produccion-etapa.dto';
import { ErrorDescarguio } from '../dtos/descarguio.dto';
import { guardarEtapa, obtenerEtapa, confirmarEtapa, anularEtapa } from '../servicios/produccion-etapas.servicio';
import { listarEtapa, opcionesEtapa } from '../servicios/produccion-etapas-consulta.servicio';
import { responderErrorProduccion } from './produccion-base.controller';
import { getAuthUser, nombreVisible } from '../utils/auth-user';
import { refrescarEmpresa } from '../utils/empresa';
export function controladorEtapa(tipo: Etapa) {
    const wrap=(fn:(req:Request)=>Promise<unknown>,status=200)=>async(req:Request,res:Response)=>{
        try {res.status(status).json(await fn(req));} catch(e){responderErrorProduccion(res,e);}
    };
    return {
        listar:wrap(r=>listarEtapa(tipo,r.query)),obtener:wrap(r=>obtenerEtapa(tipo,r.params.id)),opciones:wrap(r=>opcionesEtapa(tipo,r.query)),
        crear:wrap(r=>guardarEtapa(tipo,null,r.body||{},getAuthUser(r)!.id),201),editar:wrap(r=>guardarEtapa(tipo,r.params.id,r.body||{},getAuthUser(r)!.id)),
        confirmar:wrap(r=>confirmarEtapa(tipo,r.params.id,r.body||{},getAuthUser(r)!.id)),anular:wrap(r=>anularEtapa(tipo,r.params.id,r.body||{},getAuthUser(r)!.id)),
        exportar:async(req:Request,res:Response)=>{try{await refrescarEmpresa();const control=tipo==='SECADO'?'secados':'guardados';return req.query.formato==='xlsx'?await enviarControlOriginal(res,control,req.query):await enviarControlPdf(res,control,req.query);}catch(e){responderErrorProduccion(res,e);}},
        documento:async(req:Request,res:Response)=>{
            try{
                if(tipo!=='SECADO')throw new ErrorDescarguio('Documento no disponible para esta etapa.',404);
                await refrescarEmpresa();
                const auth=getAuthUser(req);
                const registro=auth?await User.findByPk(auth.id,{attributes:['id','username','nombre']}):null;
                const plano=registro?(registro.get({plain:true}) as {nombre?:string|null;username?:string|null}):null;
                const usuario=nombreVisible(plano,auth?{username:auth.username}:null);
                await enviarBoletaSecadoPdf(res,req.params.id,usuario==='-'?'':usuario);
            }catch(e){responderErrorProduccion(res,e);}
        }
    };
}
