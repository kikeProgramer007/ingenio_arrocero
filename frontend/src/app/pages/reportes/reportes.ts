import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { ToastModule } from 'primeng/toast';
import { apiUrl } from '../../core/utils/api-url';
import { formatBs } from '../caja/caja.utils';
import { BotonesExportarComponent } from '../../shared/components/botones-exportar';

@Component({
    selector: 'app-reportes',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, DatePickerModule, ToastModule, BotonesExportarComponent],
    providers: [MessageService],
    template: `
        <p-toast />
        <div class="mb-6">
            <div class="text-surface-900 dark:text-surface-0 font-semibold text-2xl mb-1">Reportes</div>
            <div class="text-muted-color">Resumen operativo del período. Puede bajar PDF o Excel con movimientos, ventas y egresos.</div>
        </div>
        <div class="card mb-4">
            <div class="flex flex-wrap gap-3 items-end">
                <div>
                    <label class="block font-bold mb-2">Rango</label>
                    <p-datepicker selectionMode="range" [(ngModel)]="rango" dateFormat="dd/mm/yy" [showIcon]="true" fluid />
                </div>
                <p-button label="Consultar" icon="pi pi-search" (onClick)="cargar()" [loading]="cargando" />
                <app-botones-exportar tipo="resumen" [fechaDesde]="fechaDesde" [fechaHasta]="fechaHasta" />
            </div>
        </div>
        <div class="grid grid-cols-12 gap-8" *ngIf="data">
            <div class="col-span-12 md:col-span-4" *ngFor="let card of cards">
                <div class="card mb-0">
                    <div class="text-muted-color mb-2">{{ card.label }}</div>
                    <div class="text-xl font-semibold">{{ card.value }}</div>
                </div>
            </div>
        </div>
    `
})
export class ReportesPage implements OnInit {
    rango: Date[] | null = null;
    data: any = null;
    cargando = false;
    cards: { label: string; value: string }[] = [];

    constructor(private http: HttpClient, private messageService: MessageService) {}

    ngOnInit(): void {
        this.cargar();
    }

    get fechaDesde(): string | undefined {
        return this.rango?.[0] ? this.ymd(this.rango[0]) : undefined;
    }

    get fechaHasta(): string | undefined {
        const hasta = this.rango?.[1] || this.rango?.[0];
        return hasta ? this.ymd(hasta) : undefined;
    }

    cargar(): void {
        this.cargando = true;
        const params: any = {};
        if (this.rango?.[0]) params.fecha_desde = this.ymd(this.rango[0]);
        if (this.rango?.[1] || this.rango?.[0]) params.fecha_hasta = this.ymd(this.rango[1] || this.rango[0]);
        this.http.get<any>(apiUrl('/api/reportes/resumen'), { params }).subscribe({
            next: (d) => {
                this.data = d;
                this.cards = [
                    { label: 'Ventas', value: `${d.ventas.cantidad} · ${formatBs(d.ventas.total)}` },
                    { label: 'Por cobrar', value: formatBs(d.ventas.por_cobrar) },
                    { label: 'Compras', value: `${d.compras.cantidad} · ${formatBs(d.compras.total)}` },
                    { label: 'Por pagar', value: formatBs(d.compras.por_pagar) },
                    { label: 'Gastos', value: formatBs(d.gastos) },
                    { label: 'Retiros', value: formatBs(d.retiros) },
                    { label: 'Acopios', value: `${d.acopios.cantidad} · ${formatBs(d.acopios.total)}` },
                    { label: 'Caja ingresos', value: formatBs(d.caja.ingresos) },
                    { label: 'Caja egresos', value: formatBs(d.caja.egresos) }
                ];
                this.cargando = false;
            },
            error: (e: HttpErrorResponse) => {
                this.cargando = false;
                this.messageService.add({ severity: 'error', summary: 'Error', detail: e?.error?.mensaje || 'No se pudo generar el reporte' });
            }
        });
    }

    private ymd(d: Date): string {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }
}
