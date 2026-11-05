import { Request, Response } from 'express';
import { Productor } from '../models';
import { getAuthUser } from '../utils/auth-user';
import { refrescarEmpresa } from '../utils/empresa';
import { enviarExcel, enviarPdf } from '../utils/exportar';
import { ErrorDescarguio } from '../dtos/descarguio.dto';
import { responderErrorProduccion } from './produccion-base.controller';
import { anularDescarguio, confirmarDescarguio, crearDescarguio, editarDescarguio, obtenerDescarguio } from '../servicios/descarguios.servicio';
import { listadoDescarguios, opcionesDescarguio, recepcionesDescarguio } from '../servicios/descarguios-consulta.servicio';
import { hojaDescarguios } from '../servicios/descarguios-reporte.servicio';

async function responder(res: Response, trabajo: () => Promise<unknown>, status = 200) {
    try { res.status(status).json(await trabajo()); } catch (e) { responderErrorProduccion(res, e); }
}
export class DescarguioController {
    static async listar(req: Request, res: Response) { await responder(res, () => listadoDescarguios(req.query)); }
    static async obtener(req: Request, res: Response) { await responder(res, () => obtenerDescarguio(req.params.id)); }
    static async opciones(req: Request, res: Response) { await responder(res, () => opcionesDescarguio(req.query)); }
    static async recepciones(req: Request, res: Response) { await responder(res, () => recepcionesDescarguio(req.query.id_detalle)); }
    static async crear(req: Request, res: Response) { await responder(res, () => crearDescarguio(req.body || {}, getAuthUser(req)!.id), 201); }
    static async editar(req: Request, res: Response) { await responder(res, () => editarDescarguio(req.params.id, req.body || {}, getAuthUser(req)!.id)); }
    static async confirmar(req: Request, res: Response) { await responder(res, () => confirmarDescarguio(req.params.id, req.body || {}, getAuthUser(req)!.id)); }
    static async anular(req: Request, res: Response) { await responder(res, () => anularDescarguio(req.params.id, req.body || {}, getAuthUser(req)!.id)); }
    static async productor(req: Request, res: Response) {
        await responder(res, async () => {
            const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
            const nit = typeof req.body?.nit_ci === 'string' ? req.body.nit_ci.trim() : '';
            const telefono = typeof req.body?.telefono === 'string' ? req.body.telefono.trim() : '';
            if (!nombre || nombre.length > 150 || nit.length > 30 || telefono.length > 30)
                throw new ErrorDescarguio('Revise el nombre, documento y teléfono del productor.', 400, { nombre: 'Nombre obligatorio (máximo 150 caracteres).' });
            if (nit && await Productor.findOne({ where: { nit_ci: nit } })) throw new ErrorDescarguio('Ya existe un productor con ese NIT/CI. Selecciónelo en el formulario.', 409);
            const p = await Productor.create({ nombre, nit_ci: nit || null, telefono: telefono || null, id_proveedor: null, activo: true });
            return { id: p.get('id'), nombre: p.get('nombre'), nit_ci: p.get('nit_ci') };
        }, 201);
    }
    static async exportar(req: Request, res: Response) {
        try {
            const formato = req.query.formato === 'xlsx' ? 'xlsx' : 'pdf';
            await refrescarEmpresa();
            const hoja = await hojaDescarguios(req.query, formato);
            if (req.query.formato === 'xlsx') await enviarExcel(res, 'control-descarguios', [hoja]);
            else enviarPdf(res, 'control-descarguios', [hoja]);
        } catch (e) { responderErrorProduccion(res, e); }
    }
}
