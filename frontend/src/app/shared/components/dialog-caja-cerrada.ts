import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { APP_ROUTES } from '../../core/constants/app-routes';

@Component({
    selector: 'app-dialog-caja-cerrada',
    standalone: true,
    imports: [CommonModule, DialogModule, ButtonModule],
    template: `
        <p-dialog header="Caja cerrada" [visible]="visible" (visibleChange)="onVisible($event)" [modal]="true" [style]="{ width: '28rem' }" [breakpoints]="{ '960px': '90vw' }">
            <div class="flex flex-col items-start gap-3">
                <i class="pi pi-lock text-3xl text-orange-500"></i>
                <p class="m-0">Para registrar cobros, pagos, gastos o retiros debes abrir caja.</p>
                <p class="m-0 text-muted-color text-sm">Una venta o compra a crédito sí se puede dejar pendiente; el dinero solo se mueve con caja abierta.</p>
            </div>
            <ng-template #footer>
                <p-button label="Ahora no" severity="secondary" [text]="true" (onClick)="cerrar()" />
                <p-button label="Ir a abrir caja" icon="pi pi-unlock" (onClick)="irACaja()" />
            </ng-template>
        </p-dialog>
    `
})
export class DialogCajaCerradaComponent {
    @Input() visible = false;
    @Output() visibleChange = new EventEmitter<boolean>();

    constructor(private router: Router) {}

    onVisible(value: boolean): void {
        this.visibleChange.emit(value);
    }

    cerrar(): void {
        this.onVisible(false);
    }

    irACaja(): void {
        this.visibleChange.emit(false);
        this.router.navigateByUrl(APP_ROUTES.caja);
    }
}
