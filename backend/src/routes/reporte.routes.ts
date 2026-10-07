import { Router } from 'express';
import { ReporteController } from '../controllers/reporte.controller';
import validateToken from './validate-token';

const router = Router();
router.get('/resumen', validateToken, ReporteController.resumen);
router.get('/cuentas-por-cobrar', validateToken, ReporteController.cuentasPorCobrar);
router.get('/exportar', validateToken, ReporteController.exportar);
export default router;
