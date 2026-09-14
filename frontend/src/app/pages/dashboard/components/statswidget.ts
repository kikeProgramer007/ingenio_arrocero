import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TagModule } from 'primeng/tag';
import { DashboardResumen } from '../../caja/caja.models';
import { APP_ROUTES } from '../../../core/constants/app-routes';
import { formatBs } from '../../caja/caja.utils';
import { KpiGridComponent, KpiItem } from '../../../shared/components/kpi-grid';

@Component({
    standalone: true,
    selector: 'app-stats-widget',
    imports: [CommonModule, TagModule, RouterModule, KpiGridComponent],
    template: `
        <app-kpi-grid class="col-span-12 mb-2" [items]="kpis" [loading]="loading" [columns]="6" />
        <div class="col-span-12" *ngIf="!loading && resumen">
            <div class="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-color mb-2">
                <span>La venta no es un ingreso: solo cuenta el dinero cobrado. Caja {{ resumen.caja.estado === 'ABIERTA' ? 'abierta' : 'cerrada' }}.</span>
                <a [routerLink]="cajaRoute" class="text-primary font-medium">Ir a caja actual</a>
            </div>
        </div>
    `
})
export class StatsWidget {
    readonly cajaRoute = APP_ROUTES.caja;
    @Input() resumen: DashboardResumen | null = null;
    @Input() loading = false;

    get kpis(): KpiItem[] {
        const r = this.resumen;
        return [
            { label: 'Ventas', value: formatBs(r?.ventas_hoy), icon: 'pi pi-shopping-cart', tone: 'neutral', hint: 'Total vendido hoy (no es dinero en caja)' },
            { label: 'Cobrado', value: formatBs(r?.cobrado_hoy), icon: 'pi pi-money-bill', tone: 'success', hint: 'Dinero recibido de clientes hoy' },
            { label: 'Por cobrar', value: formatBs(r?.por_cobrar), icon: 'pi pi-clock', tone: 'warn', hint: 'Saldo pendiente de ventas' },
            { label: 'Ingresos', value: formatBs(r?.ingresos_hoy), icon: 'pi pi-arrow-down-left', tone: 'success', hint: 'Todo lo que ingresó hoy' },
            { label: 'Egresos', value: formatBs(r?.egresos_hoy), icon: 'pi pi-arrow-up-right', tone: 'danger', hint: 'Pagos, gastos y retiros de hoy' },
            { label: 'Saldo neto', value: formatBs(r?.saldo_neto), icon: 'pi pi-wallet', tone: 'info', hint: 'Ingresos menos egresos del día' }
        ];
    }
}
