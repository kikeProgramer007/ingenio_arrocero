import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { CajaService } from '../caja/caja.service';
import { DashboardResumen } from '../caja/caja.models';
import { AvisoService } from '../../shared/services/aviso.service';
import { etiquetaCategoria, formatBs, formatFechaCorta } from '../caja/caja.utils';
import { APP_ROUTES } from '../../core/constants/app-routes';
import { EstadoVacioComponent } from '../../shared/components/estado-vacio';
import { TablaEsqueletoComponent } from '../../shared/components/tabla-esqueleto';
import { RecentSalesWidget } from './components/recentsaleswidget';
import { RevenueStreamWidget } from './components/revenuestreamwidget';
import { StatsWidget } from './components/statswidget';
import { EmpresaService } from '../../core/services/empresa.service';
import { TablaBusquedaComponent } from '../../shared/components/tabla-busqueda';
import { FILAS_TABLA, filtrarTabla } from '../../shared/utils/tabla';

@Component({
    selector: 'app-dashboard',
    imports: [CommonModule, FormsModule, ButtonModule, RouterModule, TableModule, TagModule, StatsWidget, RecentSalesWidget, RevenueStreamWidget, EstadoVacioComponent, TablaEsqueletoComponent, TablaBusquedaComponent],
    template: `
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6 min-w-0">
            <div class="flex items-start sm:items-center gap-3 min-w-0">
                <img [src]="empresa.logo()" [alt]="empresa.nombreUi()" class="h-12 w-12 rounded-md object-cover shrink-0" />
                <div class="min-w-0">
                    <div class="text-surface-900 dark:text-surface-0 font-semibold text-2xl mb-1">Resumen de la caja actual</div>
                    <div class="text-muted-color">Movimientos de la caja principal abierta. La caja chica no entra en este resumen.</div>
                    <div class="text-sm text-muted-color" *ngIf="resumen?.caja?.fecha_apertura">
                        Apertura {{ formatFechaCorta(resumen?.caja?.fecha_apertura) }} · consulta hasta {{ hasta || 'ahora' }}
                    </div>
                </div>
            </div>
            <div class="flex flex-wrap gap-2 shrink-0 items-end">
                <div>
                    <label class="block text-xs mb-1">Desde</label>
                    <input class="p-inputtext" type="date" [(ngModel)]="desde" (change)="cargar()" />
                </div>
                <div>
                    <label class="block text-xs mb-1">Hasta</label>
                    <input class="p-inputtext" type="date" [(ngModel)]="hasta" (change)="cargar()" />
                </div>
                <p-button label="Ingresos y egresos" icon="pi pi-arrows-h" [outlined]="true" [routerLink]="controlRoute" />
                <p-button *ngIf="error" label="Reintentar" icon="pi pi-refresh" (onClick)="cargar()" />
            </div>
        </div>

        <div class="card mb-6 p-4 flex flex-wrap items-center justify-between gap-3" *ngIf="!loading && resumen && resumen.caja.estado !== 'ABIERTA'">
            <div class="flex items-center gap-3">
                <i class="pi pi-lock text-2xl text-orange-500"></i>
                <div>
                    <div class="font-medium">No hay una caja principal abierta</div>
                    <div class="text-muted-color text-sm">Abra la caja para ver el resumen de la caja actual.</div>
                </div>
            </div>
            <p-button label="Abrir caja" icon="pi pi-unlock" [routerLink]="cajaRoute" />
        </div>

        <div class="card mb-6 p-4" *ngIf="!loading && resumen?.ventas_anuladas">
            <div class="text-muted-color text-sm">Ventas anuladas en el período, por fecha de anulación</div>
            <div class="font-semibold text-xl">{{ resumen?.ventas_anuladas?.cantidad || 0 }} · {{ formatBs(resumen?.ventas_anuladas?.importe || 0) }}</div>
        </div>

        <div class="card mb-6" *ngIf="error">
            <div class="flex items-center gap-3 text-red-500">
                <i class="pi pi-exclamation-circle text-2xl"></i>
                <span>{{ error }}</span>
            </div>
        </div>

        <div class="grid grid-cols-12 gap-4 min-w-0">
            <app-stats-widget class="contents" [resumen]="resumen" [loading]="loading" />
            <div class="col-span-12 xl:col-span-6 min-w-0">
                <app-revenue-stream-widget [resumen]="resumen" [loading]="loading" />
                <div class="card">
                    <div class="font-semibold text-xl mb-4">Egresos por tipo en el período</div>
                    <div class="flex flex-col gap-3" *ngIf="!loading">
                        <div class="flex justify-between" *ngFor="let fila of egresosTipo">
                            <span class="text-muted-color">{{ fila.label }}</span>
                            <span class="font-medium">{{ formatBs(fila.monto) }}</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-span-12 xl:col-span-6 min-w-0">
                <app-recent-sales-widget [resumen]="resumen" [loading]="loading" />
            </div>
            <div class="col-span-12 min-w-0">
                <div class="card">
                    <p-table
                        #dtPendientes
                        [value]="loading ? [] : (resumen?.cuentas_pendientes || [])"
                        [loading]="loading"
                        [showLoader]="false"
                        [paginator]="true"
                        [rows]="10"
                        [rowsPerPageOptions]="filasTabla"
                        [showCurrentPageReport]="true"
                        currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} cuentas"
                        [globalFilterFields]="['id', 'cliente.nombre', 'estado']"
                        [rowHover]="true"
                        responsiveLayout="scroll"
                    >
                        <ng-template #caption>
                            <div class="flex flex-wrap items-center justify-between gap-3">
                                <span class="font-semibold">Cuentas pendientes</span>
                                <div class="flex flex-wrap items-center gap-3">
                                    <a [routerLink]="cobranzasRoute" class="text-primary text-sm whitespace-nowrap">Registrar cobranza</a>
                                    <app-tabla-busqueda (buscar)="filtrarTabla(dtPendientes, $event)" />
                                </div>
                            </div>
                        </ng-template>
                        <ng-template #header>
                            <tr><th>Venta</th><th>Cliente</th><th>Total</th><th>Cobrado</th><th>Pendiente</th><th>Vence</th><th>Días</th><th>Situación</th><th>Estado</th></tr>
                        </ng-template>
                        <ng-template #body let-item>
                            <tr>
                                <td>#{{ item.id }}</td>
                                <td>{{ item.cliente?.nombre || '-' }}</td>
                                <td>{{ formatBs(item.total) }}</td>
                                <td>{{ formatBs(item.cobrado) }}</td>
                                <td class="font-medium">{{ formatBs(item.pendiente) }}</td>
                                <td>{{ item.fecha_vencimiento ? formatFechaCorta(item.fecha_vencimiento) : '-' }}</td>
                                <td>{{ textoDias(item) }}</td>
                                <td><p-tag [value]="etiquetaSituacion(item.situacion)" [severity]="severidadSituacion(item.situacion)" /></td>
                                <td><p-tag [value]="item.estado" [severity]="item.estado === 'PARCIAL' ? 'info' : 'warn'" /></td>
                            </tr>
                        </ng-template>
                        <ng-template #loadingbody>
                            <tr *ngFor="let f of [0,1,2,3,4,5,6,7,8]" app-tabla-esqueleto [columnas]="9" [fila]="f"></tr>
                        </ng-template>
                        <ng-template #emptymessage>
                            <tr>
                                <td colspan="9">
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
    filasTabla = FILAS_TABLA;
    filtrarTabla = filtrarTabla;
    resumen: DashboardResumen | null = null;
    loading = true;
    error: string | null = null;
    formatBs = formatBs;
    formatFechaCorta = formatFechaCorta;
    controlRoute = APP_ROUTES.ingresosEgresos;
    cobranzasRoute = APP_ROUTES.cobranzas;
    cajaRoute = APP_ROUTES.caja;
    empresa = inject(EmpresaService);
    desde = '';
    hasta = '';

    etiquetaSituacion(situacion?: string): string {
        if (situacion === 'VENCIDA') return 'Vencido';
        if (situacion === 'VENCE HOY') return 'Vence hoy';
        if (situacion === 'POR VENCER') return 'Próximo a vencer';
        if (situacion === 'AL DIA') return 'Al día';
        if (situacion === 'PAGADA') return 'Pagado';
        if (situacion === 'SIN PLAZO') return 'Sin plazo';
        return situacion || '-';
    }

    textoDias(item: { dias_vencimiento?: number | null }): string {
        const dias = item.dias_vencimiento;
        if (dias === null || dias === undefined) {
            return '-';
        }
        if (dias < 0) {
            return `${Math.abs(dias)} vencidos`;
        }
        return dias === 0 ? 'hoy' : `faltan ${dias}`;
    }

    severidadSituacion(situacion?: string): 'danger' | 'warn' | 'success' | 'secondary' {
        if (situacion === 'VENCIDA') return 'danger';
        if (situacion === 'VENCE HOY' || situacion === 'POR VENCER') return 'warn';
        if (situacion === 'AL DIA' || situacion === 'PAGADA') return 'success';
        return 'secondary';
    }

    constructor(private cajaService: CajaService, private aviso: AvisoService) {}

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
        this.cajaService.resumenDashboard({ fecha_desde: this.desde, fecha_hasta: this.hasta }).subscribe({
            next: (data) => {
                this.resumen = data;
                this.loading = false;
            },
            error: (err) => {
                this.loading = false;
                this.error = this.aviso.error(err, 'No se pudo cargar el dashboard').resumen;
            }
        });
    }
}
