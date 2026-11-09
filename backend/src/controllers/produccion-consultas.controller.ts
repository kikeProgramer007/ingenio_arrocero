import { enviarControlPdf, enviarControlConsolidadoPdf } from '../servicios/produccion-controles-pdf.servicio';
import { enviarControlOriginal, enviarControlConsolidadoExcel, controlesOriginales } from '../servicios/produccion-controles-excel.servicio';
import { Request, Response } from 'express';
import { consultarLotes, detalleLote, opcionesLotes, hojaLotes } from '../servicios/produccion-trazabilidad.servicio';
import { consultarReporteProduccion, hojaReporteProduccion, normalizarModulosConsolidado } from '../servicios/produccion-reportes.servicio';
import { modulosProduccionConLectura, responderErrorProduccion } from './produccion-base.controller';
import { refrescarEmpresa } from '../utils/empresa';
import { enviarExcel, enviarPdf } from '../utils/exportar';
import { getAuthUser } from '../utils/auth-user';
import { User } from '../models';

const envolver = (fn: (r: Request) => Promise<unknown>) => async (r: Request, s: Response) => {
    try {
        s.json(await fn(r));
    } catch (e) {
        responderErrorProduccion(s, e);
    }
};

async function tiposConsolidado(req: Request): Promise<string[]> {
    const usuario = await User.findByPk(getAuthUser(req)?.id);
    const permitidos = usuario ? await modulosProduccionConLectura(Number(usuario.get('id_perfil'))) : [];
    const pedidos = normalizarModulosConsolidado(req.query.modulos);
    return pedidos.filter(t => permitidos.includes(t));
}

export const consultasProduccion = {
    lotes: envolver(r => consultarLotes(r.query)),
    lote: envolver(r => detalleLote(r.params.id)),
    opciones: envolver(() => opcionesLotes()),
    reporte: envolver(async r => {
        if (r.params.tipo === 'consolidado') {
            const tipos = await tiposConsolidado(r);
            return consultarReporteProduccion('consolidado', { ...r.query, modulos: tipos.join(',') });
        }
        return consultarReporteProduccion(r.params.tipo, r.query);
    }),
    exportar: async (r: Request, s: Response) => {
        try {
            await refrescarEmpresa();
            if (r.params.tipo === 'consolidado') {
                const tipos = await tiposConsolidado(r);
                if (!tipos.length) {
                    s.status(400).json({ mensaje: 'No tiene módulos de producción para consolidar.' });
                    return;
                }
                if (r.query.formato === 'xlsx') return await enviarControlConsolidadoExcel(s, r.query, tipos);
                return await enviarControlConsolidadoPdf(s, r.query, tipos);
            }
            if (controlesOriginales.includes(r.params.tipo)) {
                return r.query.formato === 'xlsx'
                    ? await enviarControlOriginal(s, r.params.tipo, r.query)
                    : await enviarControlPdf(s, r.params.tipo, r.query);
            }
            const formato = r.query.formato === 'xlsx' ? 'xlsx' : 'pdf';
            const hoja = r.params.tipo ? await hojaReporteProduccion(r.params.tipo, r.query, formato) : await hojaLotes(r.query, formato);
            hoja.cabeceraReporte = true;
            if (formato === 'xlsx') await enviarExcel(s, 'produccion-' + (r.params.tipo || 'lotes'), [hoja]);
            else enviarPdf(s, 'produccion-' + (r.params.tipo || 'lotes'), [hoja]);
        } catch (e) {
            responderErrorProduccion(s, e);
        }
    }
};
