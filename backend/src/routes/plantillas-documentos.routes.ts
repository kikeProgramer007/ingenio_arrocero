import { Router } from 'express';
import validateToken from './validate-token';
import { PLANTILLAS_DOCUMENTOS } from '../servicios/plantillas-documentos.servicio';
import { handleError } from '../utils/error.handler';

const router = Router();
router.use(validateToken);
router.get('/', (_req, res) => {
    res.json(PLANTILLAS_DOCUMENTOS.map(({ id, nombre, descripcion, categoria }) => ({ id, nombre, descripcion, categoria })));
});
router.get('/:id/pdf', async (req, res) => {
    const plantilla = PLANTILLAS_DOCUMENTOS.find((p) => p.id === req.params.id);
    if (!plantilla) {
        res.status(404).json({ mensaje: 'Plantilla no disponible' });
        return;
    }
    const paginas = Number(req.query.paginas ?? 1);
    if (!Number.isInteger(paginas) || paginas < 1 || paginas > 10) {
        res.status(400).json({ mensaje: 'Seleccione entre 1 y 10 paginas' });
        return;
    }
    try {
        const pdf = await plantilla.generar(paginas);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${plantilla.id}-prueba-${paginas}-paginas.pdf"`);
        res.setHeader('Cache-Control', 'no-store');
        res.send(pdf.buffer);
    } catch (error) {
        handleError(res, error, 'No se pudo generar la plantilla');
    }
});
export default router;
