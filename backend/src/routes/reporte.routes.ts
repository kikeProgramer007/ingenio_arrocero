import { Router } from 'express';
import { ReporteController } from '../controllers/reporte.controller';
import validateToken from './validate-token';

const router = Router();
router.get('/resumen', validateToken, ReporteController.resumen);
export default router;
