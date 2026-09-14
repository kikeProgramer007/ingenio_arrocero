import { Request, Response } from 'express';
import path from 'path';
import multer from 'multer';
import { handleError } from '../utils/error.handler';
import { IMAGEN_DEFAULT, TipoImagen, asegurarDirectoriosImagen, uploadsRoot } from '../utils/imagen';

const TIPOS: TipoImagen[] = ['producto', 'cliente', 'proveedor'];

const storage = multer.diskStorage({
    destination: (req, _file, cb) => {
        asegurarDirectoriosImagen();
        const tipo = tipoDesde(req);
        cb(null, path.join(uploadsRoot(), carpetaTipo(tipo)));
    },
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
        cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    }
});

export const uploadImagen = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const ok = /image\/(jpeg|jpg|png|webp|gif|svg\+xml)/.test(file.mimetype);
        if (ok) {
            cb(null, true);
            return;
        }
        cb(new Error('Solo se permiten imágenes JPG, PNG, WEBP, GIF o SVG'));
    }
});

function carpetaTipo(tipo: TipoImagen): string {
    if (tipo === 'proveedor') {
        return 'proveedores';
    }
    return `${tipo}s`;
}

function tipoDesde(req: Request): TipoImagen {
    const tipo = String(req.query.tipo || req.body?.tipo || 'producto') as TipoImagen;
    return TIPOS.includes(tipo) ? tipo : 'producto';
}

export class UploadController {
    public static subir(req: Request, res: Response): void {
        try {
            const file = (req as Request & { file?: Express.Multer.File }).file;
            const tipo = tipoDesde(req);
            if (!file) {
                res.status(200).json({
                    mensaje: 'Sin archivo; se usará la imagen por defecto',
                    url: IMAGEN_DEFAULT[tipo],
                    default: true
                });
                return;
            }
            const url = `/uploads/${carpetaTipo(tipo)}/${file.filename}`;
            res.status(201).json({ mensaje: 'Imagen cargada', url, default: false });
        } catch (error) {
            handleError(res, error, 'Error al subir la imagen');
        }
    }
}
