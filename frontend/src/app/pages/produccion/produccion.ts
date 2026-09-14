import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { apiUrl } from '../../core/utils/api-url';
import { formatFecha } from '../caja/caja.utils';

@Component({
    selector: 'app-produccion',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, DialogModule, InputNumberModule, SelectModule, TableModule, TextareaModule, ToastModule],
    providers: [MessageService],
    template: `
        <p-toast />
        <div class="mb-6 flex flex-wrap justify-between gap-3">
            <div>
                <div class="text-surface-900 dark:text-surface-0 font-semibold text-2xl mb-1">Producción</div>
                <div class="text-muted-color">Convierte materia prima (chala) en producto terminado</div>
            </div>
            <p-button label="Nueva producción" icon="pi pi-plus" (onClick)="dialog = true" />
        </div>
        <div class="card">
            <p-table [value]="items" [loading]="cargando" [paginator]="true" [rows]="10">
                <ng-template #header>
                    <tr><th>Fecha</th><th>Origen</th><th>Entrada</th><th>Destino</th><th>Salida</th><th>Merma</th></tr>
                </ng-template>
                <ng-template #body let-p>
                    <tr>
                        <td>{{ formatFecha(p.fecha) }}</td>
                        <td>{{ p.producto_origen?.nombre }}</td>
                        <td>{{ p.cantidad_entrada }}</td>
                        <td>{{ p.producto_destino?.nombre }}</td>
                        <td>{{ p.cantidad_salida }}</td>
                        <td>{{ p.merma }}</td>
                    </tr>
                </ng-template>
            </p-table>
        </div>
        <p-dialog header="Registrar producción" [(visible)]="dialog" [modal]="true" [style]="{ width: '32rem' }">
            <div class="flex flex-col gap-3">
                <div><label class="block font-bold mb-2">Producto origen</label><p-select [options]="productos" optionLabel="nombre" optionValue="id" [(ngModel)]="form.id_producto_origen" fluid /></div>
                <div><label class="block font-bold mb-2">Cantidad entrada</label><p-inputNumber [(ngModel)]="form.cantidad_entrada" [min]="0.001" [maxFractionDigits]="3" fluid /></div>
                <div><label class="block font-bold mb-2">Producto destino</label><p-select [options]="productos" optionLabel="nombre" optionValue="id" [(ngModel)]="form.id_producto_destino" fluid /></div>
                <div><label class="block font-bold mb-2">Cantidad salida</label><p-inputNumber [(ngModel)]="form.cantidad_salida" [min]="0.001" [maxFractionDigits]="3" fluid /></div>
                <div><label class="block font-bold mb-2">Observación</label><textarea pTextarea class="w-full" rows="2" [(ngModel)]="form.observacion"></textarea></div>
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="dialog = false" />
                <p-button label="Guardar" [loading]="guardando" (onClick)="guardar()" />
            </ng-template>
        </p-dialog>
    `
})
export class ProduccionPage implements OnInit {
    items: any[] = [];
    productos: any[] = [];
    cargando = false;
    guardando = false;
    dialog = false;
    form: any = {};
    formatFecha = formatFecha;

    constructor(private http: HttpClient, private messageService: MessageService) {}

    ngOnInit(): void {
        this.http.get<any[]>(apiUrl('/api/productos')).subscribe({ next: (d) => (this.productos = d) });
        this.cargar();
    }

    cargar(): void {
        this.cargando = true;
        this.http.get<any[]>(apiUrl('/api/producciones')).subscribe({
            next: (d) => { this.items = d; this.cargando = false; },
            error: (e) => { this.cargando = false; this.err(e); }
        });
    }

    guardar(): void {
        this.guardando = true;
        this.http.post<{ mensaje: string }>(apiUrl('/api/producciones'), this.form).subscribe({
            next: (res) => { this.guardando = false; this.dialog = false; this.messageService.add({ severity: 'success', summary: 'Listo', detail: res.mensaje }); this.cargar(); },
            error: (e) => { this.guardando = false; this.err(e); }
        });
    }

    private err(e: HttpErrorResponse) {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: e?.error?.mensaje || e?.error?.errores?.[0] || 'Error' });
    }
}
