import fs from 'fs';
import path from 'path';
import { uploadsRoot } from './imagen';

export function datosEmpresa() {
    return {
        nombre: (process.env.EMPRESA_NOMBRE || 'Ingenio Arrocero Royal').trim(),
        titular: (process.env.EMPRESA_TITULAR || '').trim(),
        direccion: (process.env.EMPRESA_DIRECCION || '').trim(),
        telefono: (process.env.EMPRESA_TELEFONO || '').trim(),
        ciudad: (process.env.EMPRESA_CIUDAD || '').trim()
    };
}

export function rutaLogotipo(): string | null {
    const archivo = path.join(uploadsRoot(), 'defaults', 'logotipo.jpeg');
    return fs.existsSync(archivo) ? archivo : null;
}
