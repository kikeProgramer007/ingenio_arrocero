import { Router } from 'express';
import { ClienteController } from '../controllers/cliente.controller';
import validateToken from './validate-token';

const router = Router();

router.get('/', validateToken, ClienteController.listar);
router.post('/', validateToken, ClienteController.crear);
router.get('/:id', validateToken, ClienteController.obtener);
router.put('/:id', validateToken, ClienteController.actualizar);

export default router;
