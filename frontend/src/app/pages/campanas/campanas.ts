import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { apiUrl } from '../../core/utils/api-url';
import { METODOS_PAGO_OPTIONS } from '../caja/caja.constants';
import { formatBs } from '../caja/caja.utils';

@Component({
    selector: 'app-campanas',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, DialogModule, InputNumberModule, InputTextModule, SelectModule, TableModule, TagModule, TextareaModule, ToastModule],
    providers: [MessageService],
    template: `
        <p-toast />
        <div class="mb-6 flex flex-wrap justify-between gap-3">
            <div>
                <div class="text-surface-900 dark:text-surface-0 font-semibold text-2xl mb-1">Campañas de acopio</div>
                <div class="text-muted-color">Compra de arroz en chala por campaña</div>
            </div>
            <p-button label="Nueva campaña" icon="pi pi-plus" (onClick)="dialogCampana = true" />
        </div>
        <div class="card">
            <p-table [value]="campanas" [loading]="cargando" [paginator]="true" [rows]="8">
                <ng-template #header>
                    <tr><th>Nombre</th><th>Inicio</th><th>Acopiado</th><th>Meta</th><th>Monto</th><th>Estado</th><th></th></tr>
                </ng-template>
                <ng-template #body let-c>
                    <tr>
                        <td>{{ c.nombre }}</td>
                        <td>{{ c.fecha_inicio }}</td>
                        <td>{{ c.total_cantidad }}</td>
                        <td>{{ c.meta_cantidad ?? '-' }}</td>
                        <td>{{ formatBs(c.total_monto) }}</td>
                        <td><p-tag [value]="c.estado" [severity]="c.estado === 'ABIERTA' ? 'success' : 'secondary'" /></td>
                        <td class="flex gap-1">
                            <p-button label="Acopio" size="small" [disabled]="c.estado !== 'ABIERTA'" (onClick)="abrirAcopio(c)" />
                            <p-button label="Cerrar" size="small" severity="secondary" [outlined]="true" [disabled]="c.estado !== 'ABIERTA'" (onClick)="cerrar(c)" />
                        </td>
                    </tr>
                </ng-template>
            </p-table>
        </div>
        <p-dialog header="Nueva campaña" [(visible)]="dialogCampana" [modal]="true" [style]="{ width: '30rem' }">
            <div class="flex flex-col gap-3">
                <div><label class="block font-bold mb-2">Nombre</label><input pInputText class="w-full" [(ngModel)]="campana.nombre" /></div>
                <div><label class="block font-bold mb-2">Fecha inicio (YYYY-MM-DD)</label><input pInputText class="w-full" [(ngModel)]="campana.fecha_inicio" /></div>
                <div><label class="block font-bold mb-2">Meta (kg)</label><p-inputNumber [(ngModel)]="campana.meta_cantidad" [min]="0" fluid /></div>
                <div><label class="block font-bold mb-2">Observación</label><textarea pTextarea class="w-full" rows="2" [(ngModel)]="campana.observacion"></textarea></div>
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="dialogCampana = false" />
                <p-button label="Crear" [loading]="guardando" (onClick)="crearCampana()" />
            </ng-template>
        </p-dialog>
        <p-dialog header="Registrar acopio" [(visible)]="dialogAcopio" [modal]="true" [style]="{ width: '32rem' }">
            <div class="flex flex-col gap-3">
                <div><label class="block font-bold mb-2">Proveedor</label><p-select [options]="proveedores" optionLabel="nombre" optionValue="id" [(ngModel)]="acopio.id_proveedor" [filter]="true" fluid /></div>
                <div><label class="block font-bold mb-2">Producto (opcional)</label><p-select [options]="productos" optionLabel="nombre" optionValue="id" [(ngModel)]="acopio.id_producto" [showClear]="true" fluid /></div>
                <div><label class="block font-bold mb-2">Descripción</label><input pInputText class="w-full" [(ngModel)]="acopio.descripcion" /></div>
                <div><label class="block font-bold mb-2">Cantidad</label><p-inputNumber [(ngModel)]="acopio.cantidad" [min]="0.001" [maxFractionDigits]="3" fluid /></div>
                <div><label class="block font-bold mb-2">Precio unitario</label><p-inputNumber [(ngModel)]="acopio.precio_unitario" mode="decimal" prefix="Bs " fluid /></div>
                <div><label class="block font-bold mb-2">Pago ahora</label><p-inputNumber [(ngModel)]="acopio.pago" mode="decimal" prefix="Bs " [min]="0" fluid /></div>
                <div><label class="block font-bold mb-2">Método</label><p-select [options]="metodos" optionLabel="label" optionValue="value" [(ngModel)]="acopio.metodo_pago" fluid /></div>
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="dialogAcopio = false" />
                <p-button label="Registrar" [loading]="guardando" (onClick)="crearAcopio()" />
            </ng-template>
        </p-dialog>
    `
})
export class CampanasPage implements OnInit {
    campanas: any[] = [];
    proveedores: any[] = [];
    productos: any[] = [];
    cargando = false;
    guardando = false;
    dialogCampana = false;
    dialogAcopio = false;
    campana: any = { nombre: '', fecha_inicio: new Date().toISOString().slice(0, 10), meta_cantidad: 0, observacion: '' };
    acopio: any = {};
    metodos = METODOS_PAGO_OPTIONS;
    formatBs = formatBs;

    constructor(private http: HttpClient, private messageService: MessageService) {}

    ngOnInit(): void {
        this.http.get<any[]>(apiUrl('/api/proveedores')).subscribe({ next: (d) => (this.proveedores = d) });
        this.http.get<any[]>(apiUrl('/api/productos')).subscribe({ next: (d) => (this.productos = d) });
        this.cargar();
    }

    cargar(): void {
        this.cargando = true;
        this.http.get<any[]>(apiUrl('/api/campanas')).subscribe({
            next: (d) => { this.campanas = d; this.cargando = false; },
            error: (e) => { this.cargando = false; this.err(e, 'No se pudo cargar'); }
        });
    }

    crearCampana(): void {
        if (!this.campana.nombre || !this.campana.fecha_inicio) {
            this.messageService.add({ severity: 'warn', summary: 'Validación', detail: 'Nombre y fecha son obligatorios' });
            return;
        }
        this.guardando = true;
        this.http.post<{ mensaje: string }>(apiUrl('/api/campanas'), this.campana).subscribe({
            next: (res) => { this.guardando = false; this.dialogCampana = false; this.messageService.add({ severity: 'success', summary: 'Listo', detail: res.mensaje }); this.cargar(); },
            error: (e) => { this.guardando = false; this.err(e, 'No se pudo crear'); }
        });
    }

    abrirAcopio(c: any): void {
        this.acopio = { id_campana: c.id, id_proveedor: null, id_producto: null, descripcion: 'Arroz en chala', cantidad: 0, precio_unitario: 0, pago: 0, metodo_pago: 'EFECTIVO' };
        this.dialogAcopio = true;
    }

    crearAcopio(): void {
        this.guardando = true;
        const payload = { ...this.acopio, id_producto: this.acopio.id_producto || undefined, metodo_pago: this.acopio.pago > 0 ? this.acopio.metodo_pago : undefined };
        this.http.post<{ mensaje: string }>(apiUrl('/api/campanas/acopios'), payload).subscribe({
            next: (res) => { this.guardando = false; this.dialogAcopio = false; this.messageService.add({ severity: 'success', summary: 'Listo', detail: res.mensaje }); this.cargar(); },
            error: (e) => { this.guardando = false; this.err(e, 'No se pudo registrar acopio'); }
        });
    }

    cerrar(c: any): void {
        this.http.put<{ mensaje: string }>(apiUrl(`/api/campanas/${c.id}/cerrar`), {}).subscribe({
            next: (res) => { this.messageService.add({ severity: 'success', summary: 'Listo', detail: res.mensaje }); this.cargar(); },
            error: (e) => this.err(e, 'No se pudo cerrar')
        });
    }

    private err(e: HttpErrorResponse, fallback: string) {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: e?.error?.mensaje || e?.error?.errores?.[0] || fallback });
    }
}
