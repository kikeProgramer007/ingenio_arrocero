import { Router } from 'express';
import validateToken from './validate-token';
import { permisoProduccion, ProduccionBaseController as controller } from '../controllers/produccion-base.controller';
import { DescarguioController as desc } from '../controllers/descarguio.controller';
import { controladorEtapa } from '../controllers/produccion-etapas.controller';
import { controladorTransformacion } from '../controllers/produccion-transformaciones.controller';

import { consultasProduccion as consultas } from '../controllers/produccion-consultas.controller';

const router = Router();
router.use(validateToken, permisoProduccion);
router.get('/resumen', controller.resumen);
router.get('/operaciones', controller.operaciones);
router.get('/lotes', consultas.lotes);
router.get('/lotes/opciones', consultas.opciones);
router.get('/lotes/exportar', consultas.exportar);
router.get('/lotes/:id', consultas.lote);
router.get('/reportes/:tipo', consultas.reporte);
router.get('/reportes/:tipo/exportar', consultas.exportar);
router.get('/catalogos', controller.catalogos);
router.get('/descarguios', desc.listar);
router.get('/descarguios/opciones', desc.opciones);
router.get('/descarguios/recepciones', desc.recepciones);
router.get('/descarguios/exportar', desc.exportar);
router.post('/descarguios/productores', desc.productor);
router.get('/descarguios/:id/documento', desc.documento);
router.get('/descarguios/:id', desc.obtener);
router.post('/descarguios', desc.crear);
router.put('/descarguios/:id', desc.editar);
router.post('/descarguios/:id/confirmar', desc.confirmar);
router.post('/descarguios/:id/anular', desc.anular);
for (const [ruta,tipo] of [['secados','SECADO'],['guardados','GUARDADO'],['procesados','PROCESADO'],['envasados','ENVASADO']] as const) {
    const c=tipo==='PROCESADO'||tipo==='ENVASADO'?controladorTransformacion(tipo):controladorEtapa(tipo);
    router.get(`/${ruta}`,c.listar);
    router.get(`/${ruta}/opciones`,c.opciones);
    router.get(`/${ruta}/exportar`,c.exportar);
    if (tipo === 'SECADO') router.get(`/${ruta}/:id/documento`, (c as ReturnType<typeof controladorEtapa>).documento);
    router.get(`/${ruta}/:id`,c.obtener);
    router.post(`/${ruta}`,c.crear);
    router.put(`/${ruta}/:id`,c.editar);
    router.post(`/${ruta}/:id/confirmar`,c.confirmar);
    router.post(`/${ruta}/:id/anular`,c.anular);
}
export default router;
