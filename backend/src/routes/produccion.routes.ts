import { Router } from 'express';
import { ProduccionController } from '../controllers/produccion.controller';
import validateToken from './validate-token';

const router = Router();
router.get('/', validateToken, ProduccionController.listar);
router.post('/', validateToken, ProduccionController.crear);
export default router;
