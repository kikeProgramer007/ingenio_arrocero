import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
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
import { METODOS_PAGO_OPTIONS } from '../caja/caja.constants';
import { formatBs, formatFecha } from '../caja/caja.utils';
import { Compra, LineaCompra, Proveedor } from './compras.models';
import { ComprasService, ProveedoresService } from './compras.service';

@Component({
    selector: 'app-compras',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        DialogModule,
        InputNumberModule,
        InputTextModule,
        SelectModule,
        TableModule,
        TagModule,
        TextareaModule,
        ToastModule
    ],
    providers: [MessageService],
    template: `
        <p-toast />
        <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
                <div class="text-surface-900 dark:text-surface-0 font-semibold text-2xl mb-1">Compras</div>
                <div class="text-muted-color">Registra compras y un pago inicial si la caja está abierta</div>
            </div>
            <p-button label="Nueva compra" icon="pi pi-plus" (onClick)="abrirNueva()" />
        </div>

        <div class="card">
            <div class="grid grid-cols-12 gap-3 mb-4">
                <div class="col-span-12 md:col-span-4">
                    <label class="block font-bold mb-2">Estado</label>
                    <p-select [options]="estados" optionLabel="label" optionValue="value" [(ngModel)]="filtroEstado" placeholder="Estado" fluid />
                </div>
                <div class="col-span-12 md:col-span-4 flex items-end">
                    <p-button label="Filtrar" icon="pi pi-filter" (onClick)="cargar()" [loading]="cargando" />
                </div>
            </div>
            <p-table [value]="compras" [loading]="cargando" [paginator]="true" [rows]="10" responsiveLayout="scroll">
                <ng-template #header>
                    <tr>
                        <th>#</th>
                        <th>Fecha</th>
                        <th>Proveedor</th>
                        <th>Total</th>
                        <th>Pagado</th>
                        <th>Saldo</th>
                        <th>Estado</th>
                        <th></th>
                    </tr>
                </ng-template>
                <ng-template #body let-compra>
                    <tr>
                        <td>{{ compra.id }}</td>
                        <td>{{ formatFecha(compra.fecha) }}</td>
                        <td>{{ compra.proveedor?.nombre || '-' }}</td>
                        <td>{{ formatBs(compra.total) }}</td>
                        <td>{{ formatBs(compra.pagado) }}</td>
                        <td>{{ formatBs(compra.saldo_pendiente) }}</td>
                        <td><p-tag [value]="compra.estado" [severity]="severidad(compra.estado)" /></td>
                        <td><p-button icon="pi pi-eye" [rounded]="true" [outlined]="true" (onClick)="ver(compra)" /></td>
                    </tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr>
                        <td colspan="8">
                            <div class="text-center py-8 text-muted-color">
                                <i class="pi pi-box text-4xl mb-3 block"></i>
                                No hay compras registradas.
                            </div>
                        </td>
                    </tr>
                </ng-template>
            </p-table>
        </div>

        <p-dialog header="Nueva compra" [(visible)]="dialogNueva" [modal]="true" [style]="{ width: '48rem' }" [breakpoints]="{ '960px': '95vw' }">
            <div class="flex flex-col gap-4">
                <div>
                    <label class="block font-bold mb-2">Proveedor</label>
                    <p-select [options]="proveedores" optionLabel="nombre" optionValue="id" [(ngModel)]="idProveedor" placeholder="Seleccione proveedor" [filter]="true" fluid />
                </div>
                <div>
                    <div class="flex justify-between items-center mb-2">
                        <label class="font-bold">Líneas</label>
                        <p-button label="Agregar línea" icon="pi pi-plus" size="small" [outlined]="true" (onClick)="agregarLinea()" />
                    </div>
                    <div class="flex flex-col gap-3" *ngFor="let linea of lineas; let i = index">
                        <div class="grid grid-cols-12 gap-2 items-end">
                            <div class="col-span-12 md:col-span-5">
                                <input pInputText class="w-full" placeholder="Descripción" [(ngModel)]="linea.descripcion" />
                            </div>
                            <div class="col-span-4 md:col-span-2">
                                <p-inputNumber [(ngModel)]="linea.cantidad" [min]="0" [minFractionDigits]="0" [maxFractionDigits]="3" fluid />
                            </div>
                            <div class="col-span-4 md:col-span-3">
                                <p-inputNumber [(ngModel)]="linea.precio_unitario" mode="decimal" [min]="0" [minFractionDigits]="2" prefix="Bs " fluid />
                            </div>
                            <div class="col-span-4 md:col-span-2">
                                <p-button icon="pi pi-trash" severity="danger" [outlined]="true" (onClick)="quitarLinea(i)" [disabled]="lineas.length === 1" />
                            </div>
                        </div>
                    </div>
                    <div class="text-right font-semibold mt-3">Total: {{ formatBs(totalLineas()) }}</div>
                </div>
                <div class="grid grid-cols-12 gap-3">
                    <div class="col-span-12 md:col-span-4">
                        <label class="block font-bold mb-2">Pago inicial</label>
                        <p-inputNumber [(ngModel)]="pagoInicial" mode="decimal" [min]="0" [minFractionDigits]="2" prefix="Bs " fluid />
                    </div>
                    <div class="col-span-12 md:col-span-4">
                        <label class="block font-bold mb-2">Método</label>
                        <p-select [options]="metodos" optionLabel="label" optionValue="value" [(ngModel)]="metodoPago" placeholder="Método" fluid />
                    </div>
                    <div class="col-span-12 md:col-span-4">
                        <label class="block font-bold mb-2">Referencia</label>
                        <input pInputText class="w-full" [(ngModel)]="referencia" />
                    </div>
                </div>
                <div>
                    <label class="block font-bold mb-2">Observación</label>
                    <textarea pTextarea class="w-full" rows="2" [(ngModel)]="observacion"></textarea>
                </div>
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="dialogNueva = false" />
                <p-button label="Registrar" [loading]="guardando" (onClick)="guardar()" />
            </ng-template>
        </p-dialog>

        <p-dialog header="Detalle de compra" [(visible)]="dialogDetalle" [modal]="true" [style]="{ width: '44rem' }" [breakpoints]="{ '960px': '95vw' }">
            <ng-container *ngIf="detalle">
                <div class="mb-3">{{ detalle.proveedor?.nombre }} · {{ formatFecha(detalle.fecha) }}</div>
                <p-tag [value]="detalle.estado" [severity]="severidad(detalle.estado)" styleClass="mb-3" />
                <p-table [value]="detalle.detalles || []">
                    <ng-template #header>
                        <tr><th>Descripción</th><th>Cant.</th><th>P. unit.</th><th>Subtotal</th></tr>
                    </ng-template>
                    <ng-template #body let-linea>
                        <tr>
                            <td>{{ linea.descripcion }}</td>
                            <td>{{ linea.cantidad }}</td>
                            <td>{{ formatBs(linea.precio_unitario) }}</td>
                            <td>{{ formatBs(linea.subtotal) }}</td>
                        </tr>
                    </ng-template>
                </p-table>
                <div class="mt-3 font-medium">Total {{ formatBs(detalle.total) }} · Saldo {{ formatBs(detalle.saldo_pendiente) }}</div>
            </ng-container>
        </p-dialog>
    `
})
export class ComprasPage implements OnInit {
    compras: Compra[] = [];
    proveedores: Proveedor[] = [];
    cargando = false;
    guardando = false;
    dialogNueva = false;
    dialogDetalle = false;
    filtroEstado = '';
    estados = [
        { label: 'Todas', value: '' },
        { label: 'Pendiente', value: 'PENDIENTE' },
        { label: 'Parcial', value: 'PARCIAL' },
        { label: 'Pagada', value: 'PAGADA' }
    ];
    metodos = METODOS_PAGO_OPTIONS;
    idProveedor: number | null = null;
    lineas: LineaCompra[] = [this.lineaVacia()];
    pagoInicial = 0;
    metodoPago = 'EFECTIVO';
    referencia = '';
    observacion = '';
    detalle: Compra | null = null;
    formatBs = formatBs;
    formatFecha = formatFecha;

    constructor(
        private comprasService: ComprasService,
        private proveedoresService: ProveedoresService,
        private messageService: MessageService
    ) {}

    ngOnInit(): void {
        this.cargar();
        this.proveedoresService.listar().subscribe({ next: (data) => (this.proveedores = data) });
    }

    cargar(): void {
        this.cargando = true;
        this.comprasService.listar({ estado: this.filtroEstado || undefined }).subscribe({
            next: (data) => {
                this.compras = data;
                this.cargando = false;
            },
            error: (err) => {
                this.cargando = false;
                this.messageService.add({ severity: 'error', summary: 'Error', detail: this.msg(err, 'No se pudo cargar compras') });
            }
        });
    }

    abrirNueva(): void {
        this.idProveedor = null;
        this.lineas = [this.lineaVacia()];
        this.pagoInicial = 0;
        this.metodoPago = 'EFECTIVO';
        this.referencia = '';
        this.observacion = '';
        this.dialogNueva = true;
    }

    agregarLinea(): void {
        this.lineas.push(this.lineaVacia());
    }

    quitarLinea(i: number): void {
        this.lineas.splice(i, 1);
    }

    totalLineas(): number {
        return this.lineas.reduce((acc, l) => acc + Number(l.cantidad || 0) * Number(l.precio_unitario || 0), 0);
    }

    guardar(): void {
        if (!this.idProveedor) {
            this.messageService.add({ severity: 'warn', summary: 'Validación', detail: 'Seleccione un proveedor' });
            return;
        }
        const lineas = this.lineas.filter((l) => l.descripcion?.trim() && Number(l.cantidad) > 0);
        if (!lineas.length) {
            this.messageService.add({ severity: 'warn', summary: 'Validación', detail: 'Agregue al menos una línea válida' });
            return;
        }
        this.guardando = true;
        this.comprasService.crear({
            id_proveedor: this.idProveedor,
            observacion: this.observacion || undefined,
            lineas: lineas.map((l) => ({
                descripcion: l.descripcion.trim(),
                cantidad: Number(l.cantidad),
                precio_unitario: Number(l.precio_unitario)
            })),
            pago_inicial: this.pagoInicial || 0,
            metodo_pago: this.pagoInicial > 0 ? this.metodoPago : undefined,
            referencia: this.referencia || undefined
        }).subscribe({
            next: (res) => {
                this.guardando = false;
                this.dialogNueva = false;
                this.messageService.add({ severity: 'success', summary: 'Compra', detail: res.mensaje });
                this.cargar();
            },
            error: (err) => {
                this.guardando = false;
                this.messageService.add({ severity: 'error', summary: 'Error', detail: this.msg(err, 'No se pudo registrar la compra') });
            }
        });
    }

    ver(compra: Compra): void {
        this.comprasService.obtener(compra.id).subscribe({
            next: (data) => {
                this.detalle = data;
                this.dialogDetalle = true;
            },
            error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: this.msg(err, 'No se pudo cargar el detalle') })
        });
    }

    severidad(estado: string): 'success' | 'warn' | 'info' | 'secondary' {
        if (estado === 'PAGADA') return 'success';
        if (estado === 'PARCIAL') return 'warn';
        if (estado === 'PENDIENTE') return 'info';
        return 'secondary';
    }

    private lineaVacia(): LineaCompra {
        return { descripcion: '', cantidad: 1, precio_unitario: 0, subtotal: 0 };
    }

    private msg(err: HttpErrorResponse, fallback: string): string {
        return err?.error?.mensaje || err?.error?.errores?.[0] || fallback;
    }
}
