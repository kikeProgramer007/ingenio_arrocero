import { NextFunction, Request, Response } from 'express';
import { PerfilProgramas, Programas, User } from '../models';
import { getAuthUser } from '../utils/auth-user';
import { handleError } from '../utils/error.handler';
import { etiquetaEvento, etiquetaTipo, listarAuditoria, rutaDocumento } from '../servicios/auditoria.servicio';

export async function permisoAuditoria(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const user = await User.findByPk(getAuthUser(req)?.id);
        const programa = await Programas.findOne({ where: { url: '/auditoria', eliminado: false } });
        const permiso = user && programa
            ? await PerfilProgramas.findOne({
                where: {
                    id_perfil: user.get('id_perfil'),
                    id_programa: programa.get('id'),
                    permiso_lectura: true
                }
            })
            : null;
        if (!user?.get('activo') || user.get('eliminado') || !permiso) {
            res.status(403).json({ mensaje: 'No tiene permiso para consultar Auditoría.' });
            return;
        }
        next();
    } catch (error) {
        handleError(res, error, 'Error al validar permiso de auditoría');
    }
}

export class AuditoriaController {
    static async listar(req: Request, res: Response) {
        try {
            const data = await listarAuditoria(req.query as Record<string, unknown>);
            res.status(200).json({
                ...data,
                items: data.items.map((item: Record<string, any>) => ({
                    id: item.id,
                    evento: item.evento,
                    evento_etiqueta: etiquetaEvento(String(item.evento || '')),
                    fecha: item.fecha,
                    motivo: item.motivo,
                    id_operacion: item.id_operacion,
                    id_lote: item.id_lote,
                    codigo: item.codigo || item.lote_codigo || null,
                    lote_codigo: item.lote_codigo || null,
                    tipo: item.tipo || null,
                    tipo_etiqueta: etiquetaTipo(String(item.tipo || '')),
                    estado_documento: item.estado_documento || null,
                    usuario: item.usuario || null,
                    ruta: rutaDocumento(item.tipo, item.id_operacion)
                }))
            });
        } catch (error) {
            handleError(res, error, 'Error al consultar la auditoría');
        }
    }
}
