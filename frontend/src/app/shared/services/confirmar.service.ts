import { Injectable } from '@angular/core';
import { ConfirmationService } from 'primeng/api';

export interface PreguntaConfirmacion {
    titulo: string;
    mensaje: string;
    icono?: string;
    aceptar?: string;
    peligro?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ConfirmarService {
    constructor(private confirmation: ConfirmationService) {}

    pedir(opts: PreguntaConfirmacion): Promise<boolean> {
        return new Promise((resolve) => {
            this.confirmation.confirm({
                header: opts.titulo,
                message: opts.mensaje,
                icon: opts.icono || (opts.peligro ? 'pi pi-exclamation-triangle' : 'pi pi-question-circle'),
                acceptLabel: opts.aceptar || 'Aceptar',
                rejectLabel: 'Cancelar',
                acceptButtonStyleClass: opts.peligro ? 'p-button-danger' : undefined,
                rejectButtonStyleClass: 'p-button-text',
                accept: () => resolve(true),
                reject: () => resolve(false)
            });
        });
    }
}
