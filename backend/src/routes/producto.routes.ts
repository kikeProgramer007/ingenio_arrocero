import { Router } from 'express';
import { ProductoController } from '../controllers/producto.controller';
import validateToken from './validate-token';

const router = Router();
router.get('/categorias', validateToken, ProductoController.categorias);
router.get('/kardex/:id', validateToken, ProductoController.kardex);
router.post('/:id/ajuste', validateToken, ProductoController.ajustar);
router.get('/', validateToken, ProductoController.listar);
router.post('/', validateToken, ProductoController.crear);
router.put('/:id', validateToken, ProductoController.actualizar);
export default router;
