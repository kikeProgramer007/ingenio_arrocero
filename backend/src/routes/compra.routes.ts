import { Router } from 'express';
import { CompraController, PagoProveedorController } from '../controllers/compra.controller';
import validateToken from './validate-token';

const router = Router();

router.get('/', validateToken, CompraController.listar);
router.post('/', validateToken, CompraController.crear);
router.get('/:id', validateToken, CompraController.obtener);

export default router;

export const pagoProveedorRouter = Router();
pagoProveedorRouter.get('/', validateToken, PagoProveedorController.listar);
pagoProveedorRouter.post('/', validateToken, PagoProveedorController.crear);
