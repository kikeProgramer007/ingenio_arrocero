import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { DashboardResumen } from '../../caja/caja.models';
import { etiquetaCategoria, formatBs, formatHora } from '../../caja/caja.utils';
import { APP_ROUTES } from '../../../core/constants/app-routes';
import { EstadoVacioComponent } from '../../../shared/components/estado-vacio';
import { TablaEsqueletoComponent } from '../../../shared/components/tabla-esqueleto';

@Component({
    standalone: true,
    selector: 'app-recent-sales-widget',
    imports: [CommonModule, TableModule, TagModule, RouterModule, EstadoVacioComponent, TablaEsqueletoComponent],
    template: `
        <div class="card !mb-8">
            <div class="flex justify-between items-center mb-4">
                <div class="font-semibold text-xl">Últimos ingresos</div>
                <a [routerLink]="cobranzasRoute" class="text-primary text-sm">Cobranzas</a>
            </div>
            <p-table [value]="loading ? [] : (resumen?.ingresos_recientes || [])" [loading]="loading" [showLoader]="false" [rows]="6" responsiveLayout="scroll">
                <ng-template #header>
                    <tr><th>Hora</th><th>Concepto</th><th>Monto</th></tr>
                </ng-template>
                <ng-template #body let-mov>
                    <tr>
                        <td>{{ formatHora(mov.fecha) }}</td>
                        <td>{{ mov.concepto }}</td>
                        <td class="text-green-600 font-medium">{{ formatBs(mov.monto) }}</td>
                    </tr>
                </ng-template>
                <ng-template #loadingbody>
                    <tr *ngFor="let f of [0,1,2,3,4]" app-tabla-esqueleto [columnas]="3" [fila]="f"></tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr><td colspan="3"><app-estado-vacio icono="pi pi-arrow-down-left" titulo="Sin ingresos hoy" mensaje="Registra una venta cobrada o una cobranza." /></td></tr>
                </ng-template>
            </p-table>
        </div>
        <div class="card !mb-8">
            <div class="flex justify-between items-center mb-4">
                <div class="font-semibold text-xl">Últimos egresos</div>
                <a [routerLink]="egresosRoute" class="text-primary text-sm">Ver control</a>
            </div>
            <p-table [value]="loading ? [] : (resumen?.egresos_recientes || [])" [loading]="loading" [showLoader]="false" [rows]="6" responsiveLayout="scroll">
                <ng-template #header>
                    <tr><th>Hora</th><th>Origen</th><th>Monto</th></tr>
                </ng-template>
                <ng-template #body let-mov>
                    <tr>
                        <td>{{ formatHora(mov.fecha) }}</td>
                        <td>{{ etiquetaCategoria(mov.categoria) }}</td>
                        <td class="text-red-500 font-medium">{{ formatBs(mov.monto) }}</td>
                    </tr>
                </ng-template>
                <ng-template #loadingbody>
                    <tr *ngFor="let f of [0,1,2,3,4]" app-tabla-esqueleto [columnas]="3" [fila]="f"></tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr><td colspan="3"><app-estado-vacio icono="pi pi-arrow-up-right" titulo="Sin egresos hoy" mensaje="Los pagos, gastos y retiros aparecerán aquí." /></td></tr>
                </ng-template>
            </p-table>
        </div>
    `
})
export class RecentSalesWidget {
    @Input() resumen: DashboardResumen | null = null;
    @Input() loading = false;
    formatBs = formatBs;
    formatHora = formatHora;
    etiquetaCategoria = etiquetaCategoria;
    cobranzasRoute = APP_ROUTES.cobranzas;
    egresosRoute = APP_ROUTES.ingresosEgresos;
}
