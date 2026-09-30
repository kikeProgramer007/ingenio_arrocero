import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';

@Component({
    selector: 'app-tabla-busqueda',
    standalone: true,
    imports: [IconFieldModule, InputIconModule, InputTextModule],
    template: `
        <p-iconfield>
            <p-inputicon styleClass="pi pi-search" />
            <input pInputText type="text" [placeholder]="placeholder" (input)="buscar.emit($event)" />
        </p-iconfield>
    `
})
export class TablaBusquedaComponent {
    @Input() placeholder = 'Buscar...';
    @Output() buscar = new EventEmitter<Event>();
}
