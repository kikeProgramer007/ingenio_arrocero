import { Router } from 'express';
import { CobranzaController, VentaController } from '../controllers/venta.controller';
import validateToken from './validate-token';
import { permisoDespacho } from '../controllers/despacho.controller';
import { despachosHabilitados } from '../servicios/despachos.servicio';

const router = Router();

router.get('/', validateToken, VentaController.listar);
router.post('/', validateToken, (req, res, next) => {
    const entregaFisica = req.body?.entrega !== 'POSTERIOR' && Array.isArray(req.body?.lineas) && req.body.lineas.some((l: any) => l.id_producto);
    if (despachosHabilitados() && entregaFisica) { void permisoDespacho(req, res, next); return; }
    next();
}, VentaController.crear);
router.put('/:id/anular', validateToken, VentaController.anular);
router.get('/:id', validateToken, VentaController.obtener);

export default router;

export const cobranzaRouter = Router();
cobranzaRouter.get('/', validateToken, CobranzaController.listar);
cobranzaRouter.post('/', validateToken, CobranzaController.crear);
