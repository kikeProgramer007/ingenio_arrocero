import { Router } from 'express';
import { GastoController } from '../controllers/gasto.controller';
import validateToken from './validate-token';

const router = Router();
router.get('/', validateToken, GastoController.listar);
router.post('/', validateToken, GastoController.crear);
export default router;
