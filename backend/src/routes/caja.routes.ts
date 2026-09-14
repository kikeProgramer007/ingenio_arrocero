import { Router } from 'express';
import { CajaController } from '../controllers/caja.controller';
import validateToken from './validate-token';

const router = Router();

router.get('/abierta', validateToken, CajaController.obtenerAbierta);
router.get('/historial', validateToken, CajaController.historial);
router.post('/', validateToken, CajaController.abrir);
router.get('/:id/movimientos', validateToken, CajaController.listarMovimientos);
router.post('/:id/movimientos', validateToken, CajaController.crearMovimiento);
router.put('/:id/cerrar', validateToken, CajaController.cerrar);
router.get('/:id', validateToken, CajaController.obtenerPorId);

export default router;
