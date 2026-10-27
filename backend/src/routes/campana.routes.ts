import { Router } from 'express';
import { CampanaController } from '../controllers/campana.controller';
import validateToken from './validate-token';

const router = Router();
router.get('/', validateToken, CampanaController.listar);
router.post('/', validateToken, (_req, res) => {
    res.status(410).json({ mensaje: 'Campaña de acopio ya no admite operaciones nuevas' });
});
router.put('/:id/cerrar', validateToken, (_req, res) => {
    res.status(410).json({ mensaje: 'Campaña de acopio ya no admite operaciones nuevas' });
});
router.post('/acopios', validateToken, (_req, res) => {
    res.status(410).json({ mensaje: 'Campaña de acopio ya no admite operaciones nuevas' });
});
export default router;
