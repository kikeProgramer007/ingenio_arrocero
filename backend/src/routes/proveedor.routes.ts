import { Router } from 'express';
import { ProveedorController } from '../controllers/proveedor.controller';
import validateToken from './validate-token';

const router = Router();

router.get('/', validateToken, ProveedorController.listar);
router.post('/', validateToken, ProveedorController.crear);
router.get('/:id', validateToken, ProveedorController.obtener);
router.put('/:id', validateToken, ProveedorController.actualizar);

export default router;
