import { Router } from 'express';
import { CampanaController } from '../controllers/campana.controller';
import validateToken from './validate-token';

const router = Router();
router.get('/', validateToken, CampanaController.listar);
router.post('/', validateToken, CampanaController.crear);
router.put('/:id/cerrar', validateToken, CampanaController.cerrar);
router.post('/acopios', validateToken, CampanaController.crearAcopio);
export default router;
