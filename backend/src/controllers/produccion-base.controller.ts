import { NextFunction, Request, Response } from 'express';
import { Op, QueryTypes } from 'sequelize';
import { PerfilProgramas, Programas, User, sequelize } from '../models';
import { getAuthUser } from '../utils/auth-user';
import { handleError } from '../utils/error.handler';
import { PROGRAMAS_PRODUCCION, VERSION_PRODUCCION } from '../constants/produccion.constants';
import { VERSION_DESCARGUIOS } from '../db/descarguio-schema';
import { VERSION_ETAPAS } from '../migrations/20261105-produccion-secados-guardados';
import { VERSION_TRANSFORMACIONES } from '../migrations/20261105-produccion-transformaciones';
import { catalogosProduccion, ErrorConsultaProduccion, filtrosProduccion, lotesProduccion, operacionesProduccion, resumenProduccion } from '../servicios/produccion-consulta.servicio';

import { reportesProduccion } from '../servicios/produccion-reportes.servicio';

const paginas: Record<string, string> = { DESCARGUIO: 'descarguios', SECADO: 'secados', GUARDADO: 'guardados', PROCESADO: 'procesados', ENVASADO: 'envasados' };
export async function permisoProduccion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const reporte = req.path.startsWith('/reportes/');
        const lotes = req.path.startsWith('/lotes');
        const reporteTipo = reporte ? req.path.split('/')[2] : '';
        if (reporte && !reportesProduccion[reporteTipo]) { res.status(404).json({mensaje:'Reporte de producción inválido.'}); return; }
        const descarguio = req.path.startsWith('/descarguios');
        const transformacion=req.path.startsWith('/procesados')?'procesados':req.path.startsWith('/envasados')?'envasados':null;
        const etapa = transformacion || (req.path.startsWith('/secados') ? 'secados' : req.path.startsWith('/guardados') ? 'guardados' : null);
        const f = filtrosProduccion(descarguio || etapa || lotes || reporte ? { ...req.query, tipo: undefined, orden: 'fecha' } : req.query, etapa || lotes || reporte ? 100 : 50);
        const pagina = (reporte ? reportesProduccion[reporteTipo].programa : lotes ? 'lotes' : null) || etapa || (descarguio ? 'descarguios' : req.path === '/lotes' ? 'lotes' : req.path === '/operaciones' && f.tipo ? paginas[f.tipo] : 'resumen');
        const urls = req.path === '/catalogos' || req.path === '/lotes/opciones' ? PROGRAMAS_PRODUCCION.map(p => p.url) : [`/produccion/${pagina}`];
        const usuario = await User.findByPk(getAuthUser(req)?.id);
        const programas = await Programas.findAll({ where: { url: { [Op.in]: urls }, eliminado: false }, attributes: ['id'] });
        const permiso = usuario && programas.length ? await PerfilProgramas.findOne({ where: {
            id_perfil: usuario.get('id_perfil'), id_programa: { [Op.in]: programas.map(p => p.get('id')) }, permiso_lectura: true
        } }) : null;
        if (!usuario?.get('activo') || usuario.get('eliminado') || !permiso) {
            res.status(403).json({ mensaje: 'No tiene permiso para consultar esta sección de Producción.' });
            return;
        }
        if (reporte) {
            const programaReporte = await Programas.findOne({where:{url:'/reportes',eliminado:false}});
            const accesoReporte = programaReporte && await PerfilProgramas.findOne({where:{id_perfil:usuario!.get('id_perfil'),id_programa:programaReporte.get('id'),permiso_lectura:true}});
            if (!accesoReporte) {res.status(403).json({mensaje:'No tiene permiso para consultar Reportes.'});return;}
        }
        const campo = req.method === 'GET' ? 'permiso_lectura' : req.method === 'PUT' || req.path.endsWith('/anular') ? 'permiso_modificacion' : 'permiso_escritura';
        if (!permiso.get(campo)) { res.status(403).json({ mensaje: 'No tiene permiso para realizar esta acción en Producción.' }); return; }
        const versiones = await sequelize.query('SELECT version FROM produccion_migraciones WHERE version = :version', {
            replacements: { version: lotes || reporte ? VERSION_TRANSFORMACIONES : transformacion ? VERSION_TRANSFORMACIONES : etapa ? VERSION_ETAPAS : descarguio ? VERSION_DESCARGUIOS : VERSION_PRODUCCION }, type: QueryTypes.SELECT
        });
        if (!versiones.length) { res.status(503).json({ mensaje: 'La estructura de Producción está pendiente de preparar.' }); return; }
        next();
    } catch (error) {
        responderErrorProduccion(res, error);
    }
}
export function responderErrorProduccion(res: Response, error: unknown): void {
    if (error instanceof ErrorConsultaProduccion) { res.status(error.status).json({ mensaje: error.message, campos: (error as { campos?: unknown }).campos }); return; }
    const codigo = (error as { parent?: { code?: string } }).parent?.code;
    if (codigo === 'ER_NO_SUCH_TABLE') { res.status(503).json({ mensaje: 'La estructura de Producción está pendiente de preparar.' }); return; }
    if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT', 'ER_DUP_ENTRY'].includes(codigo || '')) { res.status(409).json({ mensaje: 'La operación coincide con otra solicitud. Vuelva a consultar el registro antes de reintentar.' }); return; }
    handleError(res, error, 'No se pudo consultar Producción');
}
export class ProduccionBaseController {
    static async resumen(req: Request, res: Response): Promise<void> {
        try { res.json(await resumenProduccion(filtrosProduccion(req.query))); } catch (e) { responderErrorProduccion(res, e); }
    }
    static async operaciones(req: Request, res: Response): Promise<void> {
        try { res.json(await operacionesProduccion(filtrosProduccion(req.query))); } catch (e) { responderErrorProduccion(res, e); }
    }
    static async lotes(req: Request, res: Response): Promise<void> {
        try { res.json(await lotesProduccion(filtrosProduccion(req.query))); } catch (e) { responderErrorProduccion(res, e); }
    }
    static async catalogos(_req: Request, res: Response): Promise<void> {
        try { res.json(await catalogosProduccion()); } catch (e) { responderErrorProduccion(res, e); }
    }
}
