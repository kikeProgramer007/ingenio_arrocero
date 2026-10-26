import { Router } from 'express';
import { GastoController } from '../controllers/gasto.controller';
import validateToken from './validate-token';

const router = Router();
router.get('/categorias', validateToken, GastoController.listarCategorias);
router.post('/categorias', validateToken, GastoController.crearCategoria);
router.get('/beneficiarios', validateToken, GastoController.listarBeneficiarios);
router.post('/beneficiarios', validateToken, GastoController.crearBeneficiario);
router.get('/', validateToken, GastoController.listar);
router.post('/', validateToken, GastoController.crear);
router.post('/:id/pagos', validateToken, GastoController.pagar);
export default router;
