import { Injectable } from '@angular/core';
import { MessageService } from 'primeng/api';
import { EmptyError } from 'rxjs';
import { ErrorApiMapeado } from '../models/errores.interface';
import { mapearErrorHttp } from '../utils/error-http';

/** RxJS EmptyError al destruir la vista a mitad de una petición (firstValueFrom + takeUntilDestroyed). */
function esCancelacionNavegacion(err: unknown): boolean {
    if (err instanceof EmptyError) return true;
    if (!err || typeof err !== 'object') return false;
    const e = err as { name?: string; message?: string };
    return e.name === 'EmptyError' || e.message === 'no elements in sequence';
}

@Injectable({ providedIn: 'root' })
export class AvisoService {
    constructor(private message: MessageService) {}

    ok(titulo: string, detalle?: string): void {
        this.message.add({ severity: 'success', summary: titulo, detail: detalle });
    }

    aviso(titulo: string, detalle?: string): void {
        this.message.add({ severity: 'warn', summary: titulo, detail: detalle });
    }

    info(titulo: string, detalle?: string): void {
        this.message.add({ severity: 'info', summary: titulo, detail: detalle });
    }

    errorTexto(titulo: string, detalle?: string): void {
        this.message.add({ severity: 'error', summary: titulo, detail: detalle, life: 8000 });
    }

    error(err: unknown, fallback: string): ErrorApiMapeado {
        // No mostrar toast al salir de una pantalla con peticiones pendientes.
        if (esCancelacionNavegacion(err)) {
            return { mensaje: '', resumen: '', errores: [], estado: null, cuerpoTexto: '' };
        }
        const mapeado = mapearErrorHttp(err, fallback);
        this.message.add({
            severity: 'error',
            summary: mapeado.mensaje,
            detail: mapeado.resumen,
            data: mapeado,
            life: mapeado.errores.length > 1 ? 14000 : 9000
        });
        return mapeado;
    }
}
