import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';

@Component({
    selector: 'app-tabla-busqueda',
    standalone: true,
    imports: [FormsModule, IconFieldModule, InputIconModule, InputTextModule],
    template: `
        <p-iconfield class="w-full">
            <p-inputicon styleClass="pi pi-search" />
            <input
                pInputText
                type="text"
                class="w-full"
                [placeholder]="placeholder"
                [ngModel]="value"
                (ngModelChange)="onTexto($event)"
                (input)="buscar.emit($event)"
            />
        </p-iconfield>
    `
})
export class TablaBusquedaComponent {
    @Input() placeholder = 'Buscar...';
    @Input() value = '';
    @Output() valueChange = new EventEmitter<string>();
    @Output() buscar = new EventEmitter<Event>();

    onTexto(valor: string): void {
        this.value = valor;
        this.valueChange.emit(valor);
    }
}
