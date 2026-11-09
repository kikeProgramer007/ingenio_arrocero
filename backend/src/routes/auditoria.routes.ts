import { Router } from 'express';
import validateToken from './validate-token';
import { AuditoriaController, permisoAuditoria } from '../controllers/auditoria.controller';

const router = Router();
router.use(validateToken, permisoAuditoria);
router.get('/', AuditoriaController.listar);

export default router;
