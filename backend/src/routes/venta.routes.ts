import { Router } from 'express';
import { CobranzaController, VentaController } from '../controllers/venta.controller';
import validateToken from './validate-token';

const router = Router();

router.get('/', validateToken, VentaController.listar);
router.post('/', validateToken, VentaController.crear);
router.get('/:id', validateToken, VentaController.obtener);

export default router;

export const cobranzaRouter = Router();
cobranzaRouter.get('/', validateToken, CobranzaController.listar);
cobranzaRouter.post('/', validateToken, CobranzaController.crear);
