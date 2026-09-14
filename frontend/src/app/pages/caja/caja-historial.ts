import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ESTADOS_CAJA_OPTIONS } from './caja.constants';
import { CajaDetalle } from './caja.models';
import { CajaService } from './caja.service';
import { etiquetaCategoria, etiquetaMetodo, formatBs, formatFecha, formatHora } from './caja.utils';

@Component({
    selector: 'app-caja-historial',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        DatePickerModule,
        DialogModule,
        SelectModule,
        SkeletonModule,
        TableModule,
        TagModule,
        ToastModule
    ],
    providers: [MessageService],
    template: `
        <p-toast />
        <div class="mb-6">
            <div class="text-surface-900 dark:text-surface-0 font-semibold text-2xl mb-1">Historial de cajas</div>
            <div class="text-muted-color">Consulta aperturas, cierres y diferencias de arqueo</div>
        </div>

        <div class="card">
            <div class="grid grid-cols-12 gap-4 mb-4">
                <div class="col-span-12 md:col-span-4">
                    <label class="block font-bold mb-2">Rango de fechas</label>
                    <p-datepicker selectionMode="range" [(ngModel)]="rangoFechas" dateFormat="dd/mm/yy" [showIcon]="true" [readonlyInput]="true" fluid />
                </div>
                <div class="col-span-12 md:col-span-3">
                    <label class="block font-bold mb-2">Estado</label>
                    <p-select [options]="estados" optionLabel="label" optionValue="value" [(ngModel)]="estado" placeholder="Estado" fluid />
                </div>
                <div class="col-span-12 md:col-span-5 flex items-end gap-2">
                    <p-button label="Filtrar" icon="pi pi-filter" (onClick)="cargar()" [loading]="cargando" />
                    <p-button label="Limpiar" icon="pi pi-times" severity="secondary" [outlined]="true" (onClick)="limpiar()" />
                </div>
            </div>

            <p-table [value]="cajas" [loading]="cargando" [paginator]="true" [rows]="10" responsiveLayout="scroll">
                <ng-template #header>
                    <tr>
                        <th>Fecha</th>
                        <th>Usuario apertura</th>
                        <th>Saldo inicial</th>
                        <th>Ingresos</th>
                        <th>Egresos</th>
                        <th>Saldo esperado</th>
                        <th>Saldo contado</th>
                        <th>Diferencia</th>
                        <th>Estado</th>
                        <th></th>
                    </tr>
                </ng-template>
                <ng-template #body let-caja>
                    <tr>
                        <td>{{ formatFecha(caja.fecha_apertura) }}</td>
                        <td>{{ caja.usuario_apertura?.username || '-' }}</td>
                        <td>{{ formatBs(caja.saldo_inicial) }}</td>
                        <td>{{ formatBs(caja.ingresos) }}</td>
                        <td>{{ formatBs(caja.egresos) }}</td>
                        <td>{{ formatBs(caja.saldo_esperado) }}</td>
                        <td>{{ caja.saldo_contado == null ? '-' : formatBs(caja.saldo_contado) }}</td>
                        <td>
                            <span [class]="claseDiferencia(caja.diferencia)">
                                {{ caja.diferencia == null ? '-' : formatBs(caja.diferencia) }}
                            </span>
                        </td>
                        <td>
                            <p-tag [value]="caja.estado" [severity]="caja.estado === 'ABIERTA' ? 'success' : 'secondary'" />
                        </td>
                        <td>
                            <p-button icon="pi pi-eye" [rounded]="true" [outlined]="true" (onClick)="verDetalle(caja)" />
                        </td>
                    </tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr>
                        <td colspan="10">
                            <div class="text-center py-8 text-muted-color">
                                <i class="pi pi-inbox text-4xl mb-3 block"></i>
                                No hay cajas para los filtros seleccionados.
                            </div>
                        </td>
                    </tr>
                </ng-template>
            </p-table>
        </div>

        <p-dialog header="Detalle de caja" [(visible)]="dialogDetalle" [modal]="true" [style]="{ width: '56rem' }" [breakpoints]="{ '960px': '95vw' }">
            <ng-container *ngIf="detalle">
                <div class="grid grid-cols-12 gap-3 mb-4 text-sm">
                    <div class="col-span-6 md:col-span-3 text-muted-color">Apertura</div>
                    <div class="col-span-6 md:col-span-3 font-medium">{{ formatFecha(detalle.fecha_apertura) }}</div>
                    <div class="col-span-6 md:col-span-3 text-muted-color">Cierre</div>
                    <div class="col-span-6 md:col-span-3 font-medium">{{ formatFecha(detalle.fecha_cierre) }}</div>
                    <div class="col-span-6 md:col-span-3 text-muted-color">Saldo esperado</div>
                    <div class="col-span-6 md:col-span-3 font-medium">{{ formatBs(detalle.saldo_esperado) }}</div>
                    <div class="col-span-6 md:col-span-3 text-muted-color">Saldo contado</div>
                    <div class="col-span-6 md:col-span-3 font-medium">{{ detalle.saldo_contado == null ? '-' : formatBs(detalle.saldo_contado) }}</div>
                </div>
                <p-tag *ngIf="detalle.resultado_arqueo" [value]="detalle.resultado_arqueo" [severity]="severidadArqueo(detalle.resultado_arqueo)" styleClass="mb-4" />
                <p-table [value]="detalle.movimientos || []" responsiveLayout="scroll">
                    <ng-template #header>
                        <tr>
                            <th>Hora</th>
                            <th>Tipo</th>
                            <th>Categoría</th>
                            <th>Concepto</th>
                            <th>Método</th>
                            <th>Monto</th>
                        </tr>
                    </ng-template>
                    <ng-template #body let-mov>
                        <tr>
                            <td>{{ formatHora(mov.fecha) }}</td>
                            <td><p-tag [value]="mov.tipo" [severity]="mov.tipo === 'INGRESO' ? 'success' : 'danger'" /></td>
                            <td>{{ etiquetaCategoria(mov.categoria) }}</td>
                            <td>{{ mov.concepto }}</td>
                            <td>{{ etiquetaMetodo(mov.metodo_pago) }}</td>
                            <td>{{ formatBs(mov.monto) }}</td>
                        </tr>
                    </ng-template>
                    <ng-template #emptymessage>
                        <tr>
                            <td colspan="6">
                                <div class="text-center py-6 text-muted-color">
                                    No existen movimientos registrados en esta caja.
                                </div>
                            </td>
                        </tr>
                    </ng-template>
                </p-table>
            </ng-container>
        </p-dialog>
    `
})
export class CajaHistorial implements OnInit {
    cajas: CajaDetalle[] = [];
    detalle: CajaDetalle | null = null;
    cargando = false;
    dialogDetalle = false;
    rangoFechas: Date[] | null = null;
    estado = '';
    estados = ESTADOS_CAJA_OPTIONS;

    formatBs = formatBs;
    formatFecha = formatFecha;
    formatHora = formatHora;
    etiquetaCategoria = etiquetaCategoria;
    etiquetaMetodo = etiquetaMetodo;

    constructor(
        private cajaService: CajaService,
        private messageService: MessageService
    ) {}

    ngOnInit(): void {
        this.cargar();
    }

    cargar(): void {
        this.cargando = true;
        const filtros: { fecha_desde?: string; fecha_hasta?: string; estado?: string } = {};
        if (this.rangoFechas?.[0]) {
            filtros.fecha_desde = this.toIsoDate(this.rangoFechas[0]);
        }
        if (this.rangoFechas?.[1]) {
            filtros.fecha_hasta = this.toIsoDate(this.rangoFechas[1]);
        }
        if (this.estado) {
            filtros.estado = this.estado;
        }

        this.cajaService.historial(filtros).subscribe({
            next: (data) => {
                this.cajas = data;
                this.cargando = false;
            },
            error: (err: HttpErrorResponse) => {
                this.cargando = false;
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: err?.error?.mensaje || 'No se pudo cargar el historial'
                });
            }
        });
    }

    limpiar(): void {
        this.rangoFechas = null;
        this.estado = '';
        this.cargar();
    }

    verDetalle(caja: CajaDetalle): void {
        this.cajaService.obtenerPorId(caja.id).subscribe({
            next: (detalle) => {
                this.detalle = detalle;
                this.dialogDetalle = true;
            },
            error: (err: HttpErrorResponse) => {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: err?.error?.mensaje || 'No se pudo cargar el detalle'
                });
            }
        });
    }

    claseDiferencia(valor: number | null): string {
        if (valor == null || valor === 0) {
            return 'font-medium';
        }
        return valor < 0 ? 'font-medium text-red-500' : 'font-medium text-green-600';
    }

    severidadArqueo(valor: string): 'success' | 'danger' | 'warn' {
        if (valor === 'CUADRE') {
            return 'success';
        }
        return valor === 'FALTANTE' ? 'danger' : 'warn';
    }

    private toIsoDate(date: Date): string {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
}
