import { Router } from 'express';
import { ProductorController } from '../controllers/productor.controller';
import validateToken from './validate-token';

const router = Router();

router.get('/', validateToken, ProductorController.listar);
router.post('/', validateToken, ProductorController.crear);
router.get('/:id', validateToken, ProductorController.obtener);
router.put('/:id', validateToken, ProductorController.actualizar);
router.delete('/:id', validateToken, ProductorController.eliminar);

export default router;
