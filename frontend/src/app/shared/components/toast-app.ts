import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ToastMessageOptions } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { ErrorApiMapeado } from '../models/errores.interface';

@Component({
    selector: 'app-toast-app',
    standalone: true,
    imports: [CommonModule, ToastModule, ButtonModule, DialogModule],
    template: `
        <p-toast position="top-right" [breakpoints]="{ '920px': { width: '92vw' } }">
            <ng-template let-message #message>
                <div class="flex items-start gap-3 w-full">
                    <i class="text-xl mt-0.5" [ngClass]="icono(message.severity)"></i>
                    <div class="flex-1 min-w-0">
                        <div class="font-semibold leading-snug">{{ message.summary }}</div>
                        <div class="text-sm mt-1 leading-snug" *ngIf="message.detail && message.detail !== message.summary">{{ message.detail }}</div>
                        <button
                            type="button"
                            class="mt-2 text-sm font-semibold underline bg-transparent border-0 p-0 cursor-pointer"
                            *ngIf="puedeVerDetalle(message)"
                            (click)="abrir(message); $event.stopPropagation()"
                        >
                            Ver detalle
                        </button>
                    </div>
                </div>
            </ng-template>
        </p-toast>

        <p-dialog header="Detalle del error" [(visible)]="visible" [modal]="true" [style]="{ width: '36rem' }" [breakpoints]="{ '960px': '95vw' }">
            <div class="flex flex-col gap-3" *ngIf="detalle">
                <div class="text-sm text-muted-color" *ngIf="detalle.estado">Código HTTP {{ detalle.estado }}</div>
                <div class="font-semibold">{{ detalle.mensaje }}</div>
                <ul class="m-0 pl-5 flex flex-col gap-1">
                    <li *ngFor="let item of detalle.errores">{{ item }}</li>
                </ul>
                <div *ngIf="detalle.cuerpoTexto">
                    <div class="font-bold mb-2">Respuesta del servidor</div>
                    <pre class="text-xs whitespace-pre-wrap break-words bg-surface-100 dark:bg-surface-800 p-3 rounded-md max-h-64 overflow-auto m-0">{{ detalle.cuerpoTexto }}</pre>
                </div>
            </div>
            <ng-template #footer>
                <p-button label="Cerrar" severity="secondary" [outlined]="true" (onClick)="visible = false" />
            </ng-template>
        </p-dialog>
    `
})
export class ToastAppComponent {
    visible = false;
    detalle: ErrorApiMapeado | null = null;

    icono(severity: string | undefined): string {
        switch (severity) {
            case 'success':
                return 'pi pi-check-circle text-green-600';
            case 'warn':
                return 'pi pi-exclamation-triangle text-orange-500';
            case 'info':
                return 'pi pi-info-circle text-blue-500';
            default:
                return 'pi pi-times-circle text-red-500';
        }
    }

    puedeVerDetalle(message: ToastMessageOptions): boolean {
        const data = message.data as ErrorApiMapeado | undefined;
        return !!data && (data.errores.length > 0 || !!data.cuerpoTexto);
    }

    abrir(message: ToastMessageOptions): void {
        this.detalle = (message.data as ErrorApiMapeado) || null;
        this.visible = true;
    }
}
