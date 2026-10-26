import { Router } from 'express';
import { CajaChicaController } from '../controllers/caja-chica.controller';
import validateToken from './validate-token';

const router = Router();

router.get('/', validateToken, CajaChicaController.resumen);
router.get('/movimientos', validateToken, CajaChicaController.movimientos);
router.post('/aportes', validateToken, CajaChicaController.aportar);
router.post('/arqueos', validateToken, CajaChicaController.arquear);

export default router;
