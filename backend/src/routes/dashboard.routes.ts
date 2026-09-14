import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller';
import validateToken from './validate-token';

const router = Router();

router.get('/resumen', validateToken, DashboardController.resumen);
router.get('/movimientos', validateToken, DashboardController.movimientos);

export default router;
