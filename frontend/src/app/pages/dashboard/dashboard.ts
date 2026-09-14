import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { CajaService } from '../caja/caja.service';
import { DashboardResumen } from '../caja/caja.models';
import { etiquetaCategoria, formatBs } from '../caja/caja.utils';
import { APP_ROUTES } from '../../core/constants/app-routes';
import { EstadoVacioComponent } from '../../shared/components/estado-vacio';
import { RecentSalesWidget } from './components/recentsaleswidget';
import { RevenueStreamWidget } from './components/revenuestreamwidget';
import { StatsWidget } from './components/statswidget';

@Component({
    selector: 'app-dashboard',
    imports: [CommonModule, ButtonModule, RouterModule, TableModule, TagModule, StatsWidget, RecentSalesWidget, RevenueStreamWidget, EstadoVacioComponent],
    template: `
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
            <div>
                <div class="text-surface-900 dark:text-surface-0 font-semibold text-2xl mb-1">Dashboard</div>
                <div class="text-muted-color">Control de ingresos y egresos del día. Una venta no es dinero cobrado.</div>
            </div>
            <div class="flex gap-2">
                <p-button label="Ingresos y egresos" icon="pi pi-arrows-h" [outlined]="true" [routerLink]="controlRoute" />
                <p-button *ngIf="error" label="Reintentar" icon="pi pi-refresh" (onClick)="cargar()" />
            </div>
        </div>

        <div class="card mb-6 p-4 flex flex-wrap items-center justify-between gap-3" *ngIf="!loading && resumen && resumen.caja.estado !== 'ABIERTA'">
            <div class="flex items-center gap-3">
                <i class="pi pi-lock text-2xl text-orange-500"></i>
                <div>
                    <div class="font-medium">Caja cerrada</div>
                    <div class="text-muted-color text-sm">Puedes consultar ventas y pendientes. Para cobrar, pagar o gastar, abre caja.</div>
                </div>
            </div>
            <p-button label="Abrir caja" icon="pi pi-unlock" [routerLink]="cajaRoute" />
        </div>

        <div class="card mb-6" *ngIf="error">
            <div class="flex items-center gap-3 text-red-500">
                <i class="pi pi-exclamation-circle text-2xl"></i>
                <span>{{ error }}</span>
            </div>
        </div>

        <div class="grid grid-cols-12 gap-8">
            <app-stats-widget class="contents" [resumen]="resumen" [loading]="loading" />
            <div class="col-span-12 xl:col-span-6">
                <app-revenue-stream-widget [resumen]="resumen" [loading]="loading" />
                <div class="card">
                    <div class="font-semibold text-xl mb-4">Egresos por tipo (hoy)</div>
                    <div class="flex flex-col gap-3" *ngIf="!loading">
                        <div class="flex justify-between" *ngFor="let fila of egresosTipo">
                            <span class="text-muted-color">{{ fila.label }}</span>
                            <span class="font-medium">{{ formatBs(fila.monto) }}</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-span-12 xl:col-span-6">
                <app-recent-sales-widget [resumen]="resumen" [loading]="loading" />
            </div>
            <div class="col-span-12">
                <div class="card">
                    <div class="flex justify-between items-center mb-4">
                        <div class="font-semibold text-xl">Cuentas pendientes</div>
                        <a [routerLink]="cobranzasRoute" class="text-primary text-sm">Registrar cobranza</a>
                    </div>
                    <p-table [value]="resumen?.cuentas_pendientes || []" [loading]="loading" responsiveLayout="scroll">
                        <ng-template #header>
                            <tr><th>Venta</th><th>Cliente</th><th>Total</th><th>Cobrado</th><th>Pendiente</th><th>Estado</th></tr>
                        </ng-template>
                        <ng-template #body let-item>
                            <tr>
                                <td>#{{ item.id }}</td>
                                <td>{{ item.cliente?.nombre || '-' }}</td>
                                <td>{{ formatBs(item.total) }}</td>
                                <td>{{ formatBs(item.cobrado) }}</td>
                                <td class="font-medium">{{ formatBs(item.pendiente) }}</td>
                                <td><p-tag [value]="item.estado" [severity]="item.estado === 'PARCIAL' ? 'info' : 'warn'" /></td>
                            </tr>
                        </ng-template>
                        <ng-template #emptymessage>
                            <tr>
                                <td colspan="6">
                                    <app-estado-vacio icono="pi pi-check-circle" titulo="No hay saldos pendientes" mensaje="Las ventas parcialmente cobradas aparecerán aquí." />
                                </td>
                            </tr>
                        </ng-template>
                    </p-table>
                </div>
            </div>
        </div>
    `
})
export class Dashboard implements OnInit {
    resumen: DashboardResumen | null = null;
    loading = true;
    error: string | null = null;
    formatBs = formatBs;
    controlRoute = APP_ROUTES.ingresosEgresos;
    cobranzasRoute = APP_ROUTES.cobranzas;
    cajaRoute = APP_ROUTES.caja;

    constructor(private cajaService: CajaService) {}

    ngOnInit(): void {
        this.cargar();
    }

    get egresosTipo() {
        const mapa = this.resumen?.egresos_por_tipo || {};
        return Object.keys(mapa).map((key) => ({
            label: etiquetaCategoria(key),
            monto: mapa[key] || 0
        }));
    }

    cargar(): void {
        this.loading = true;
        this.error = null;
        this.cajaService.resumenDashboard().subscribe({
            next: (data) => {
                this.resumen = data;
                this.loading = false;
            },
            error: (err) => {
                this.loading = false;
                this.error = err?.error?.mensaje || 'No se pudo cargar el dashboard';
            }
        });
    }
}
