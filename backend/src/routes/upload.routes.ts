import { Router } from 'express';
import { UploadController, uploadImagen } from '../controllers/upload.controller';
import validateToken from './validate-token';

const router = Router();
router.post('/', validateToken, (req, res, next) => {
    uploadImagen.single('imagen')(req, res, (err: unknown) => {
        if (err) {
            const mensaje = err instanceof Error ? err.message : 'No se pudo subir la imagen';
            res.status(400).json({ mensaje });
            return;
        }
        next();
    });
}, UploadController.subir);
export default router;
