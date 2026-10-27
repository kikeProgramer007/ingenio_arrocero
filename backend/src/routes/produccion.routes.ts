import { Router } from 'express';
import { ProduccionController } from '../controllers/produccion.controller';
import validateToken from './validate-token';

const router = Router();
router.get('/', validateToken, ProduccionController.listar);
router.post('/', validateToken, (_req, res) => {
    res.status(410).json({ mensaje: 'Producción ya no admite operaciones nuevas' });
});
export default router;
