import { Request, Response } from 'express';
import { Empresa } from '../models/empresa.model';
import { ActualizarEmpresaDTO } from '../dtos/empresa.dto';
import { handleError } from '../utils/error.handler';
import { DtoValidator } from '../utils/dto.validador';
import { mapEmpresa, refrescarEmpresa } from '../utils/empresa';

export class EmpresaController {
    public static async obtener(_req: Request, res: Response): Promise<void> {
        try {
            const datos = await refrescarEmpresa();
            res.status(200).json(datos);
        } catch (error) {
            handleError(res, error, 'Error al obtener los datos de la empresa');
        }
    }

    public static async actualizar(req: Request, res: Response): Promise<void> {
        const datos = await DtoValidator.validateAndRespond(ActualizarEmpresaDTO, req.body, res);
        if (!datos) {
            return;
        }
        try {
            let empresa = await Empresa.findOne({ order: [['id', 'ASC']] });
            const payload = {
                nombre: datos.nombre.trim(),
                nombre_corto: datos.nombre_corto?.trim() || null,
                slogan: datos.slogan?.trim() || null,
                titular: datos.titular?.trim() || null,
                nit: datos.nit?.trim() || null,
                direccion: datos.direccion?.trim() || null,
                telefono: datos.telefono?.trim() || null,
                ciudad: datos.ciudad?.trim() || null,
                email: datos.email?.trim() || null,
                path_logo: (datos.path_logo || '').trim() || '/uploads/defaults/logotipo.jpeg'
            };
            if (!empresa) {
                empresa = await Empresa.create(payload);
            } else {
                await empresa.update(payload);
            }
            const actualizado = mapEmpresa(empresa);
            await refrescarEmpresa();
            res.status(200).json({ mensaje: 'Datos de la empresa actualizados', data: actualizado });
        } catch (error) {
            handleError(res, error, 'Error al actualizar los datos de la empresa');
        }
    }
}
