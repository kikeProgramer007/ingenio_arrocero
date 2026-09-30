import { Router } from 'express';
import { EmpresaController } from '../controllers/empresa.controller';
import validateToken from './validate-token';

const router = Router();

router.get('/', EmpresaController.obtener);
router.put('/', validateToken, EmpresaController.actualizar);

export default router;
