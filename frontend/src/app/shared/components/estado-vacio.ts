import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
    selector: 'app-estado-vacio',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="text-center py-10 px-4 text-muted-color">
            <i class="text-4xl mb-3 block" [ngClass]="icono"></i>
            <div class="font-medium text-surface-900 dark:text-surface-0 mb-1">{{ titulo }}</div>
            <div>{{ mensaje }}</div>
        </div>
    `
})
export class EstadoVacioComponent {
    @Input() icono = 'pi pi-inbox';
    @Input() titulo = 'No hay registros';
    @Input() mensaje = 'Cuando existan datos, aparecerán en esta lista.';
}
