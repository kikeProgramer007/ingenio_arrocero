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

@Component({
    selector: 'app-reportes',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, DatePickerModule, ToastModule],
    providers: [MessageService],
    template: `
        <p-toast />
        <div class="mb-6">
            <div class="text-surface-900 dark:text-surface-0 font-semibold text-2xl mb-1">Reportes</div>
            <div class="text-muted-color">Resumen operativo del período</div>
        </div>
        <div class="card mb-4">
            <div class="flex flex-wrap gap-3 items-end">
                <div>
                    <label class="block font-bold mb-2">Rango</label>
                    <p-datepicker selectionMode="range" [(ngModel)]="rango" dateFormat="dd/mm/yy" [showIcon]="true" fluid />
                </div>
                <p-button label="Consultar" icon="pi pi-search" (onClick)="cargar()" [loading]="cargando" />
            </div>
        </div>
        <div class="grid grid-cols-12 gap-4" *ngIf="data">
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

    cargar(): void {
        this.cargando = true;
        const params: any = {};
        if (this.rango?.[0]) params.fecha_desde = this.iso(this.rango[0]);
        if (this.rango?.[1]) params.fecha_hasta = this.iso(this.rango[1]);
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

    private iso(d: Date): string {
        return d.toISOString().slice(0, 10);
    }
}
