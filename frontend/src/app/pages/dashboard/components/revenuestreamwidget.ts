import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { ChartModule } from 'primeng/chart';
import { SkeletonModule } from 'primeng/skeleton';
import { Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { LayoutService } from '../../../layout/service/layout.service';
import { DashboardResumen } from '../../caja/caja.models';

@Component({
    standalone: true,
    selector: 'app-revenue-stream-widget',
    imports: [ChartModule, CommonModule, SkeletonModule],
    template: `<div class="card !mb-8">
        <div class="font-semibold text-xl mb-4">Ingresos vs Egresos</div>
        <p-skeleton *ngIf="loading" height="20rem" />
        <p-chart *ngIf="!loading" type="bar" [data]="chartData" [options]="chartOptions" class="h-80" />
    </div>`
})
export class RevenueStreamWidget implements OnChanges, OnDestroy {
    @Input() resumen: DashboardResumen | null = null;
    @Input() loading = false;

    chartData: any;
    chartOptions: any;
    subscription!: Subscription;

    constructor(public layoutService: LayoutService) {
        this.subscription = this.layoutService.configUpdate$.pipe(debounceTime(25)).subscribe(() => {
            this.initChart();
        });
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['resumen']) {
            this.initChart();
        }
    }

    initChart() {
        const documentStyle = getComputedStyle(document.documentElement);
        const textColor = documentStyle.getPropertyValue('--text-color');
        const borderColor = documentStyle.getPropertyValue('--surface-border');
        const textMutedColor = documentStyle.getPropertyValue('--text-color-secondary');
        const ingresos = this.resumen?.ingresos_hoy ?? 0;
        const egresos = this.resumen?.egresos_hoy ?? 0;

        this.chartData = {
            labels: ['Hoy'],
            datasets: [
                {
                    type: 'bar',
                    label: 'Ingresos',
                    backgroundColor: documentStyle.getPropertyValue('--p-green-400') || '#4ade80',
                    data: [ingresos],
                    barThickness: 48
                },
                {
                    type: 'bar',
                    label: 'Egresos',
                    backgroundColor: documentStyle.getPropertyValue('--p-red-400') || '#f87171',
                    data: [egresos],
                    barThickness: 48
                }
            ]
        };

        this.chartOptions = {
            maintainAspectRatio: false,
            aspectRatio: 0.8,
            plugins: {
                legend: {
                    labels: { color: textColor }
                }
            },
            scales: {
                x: {
                    ticks: { color: textMutedColor },
                    grid: { color: 'transparent', borderColor: 'transparent' }
                },
                y: {
                    ticks: { color: textMutedColor },
                    grid: { color: borderColor, borderColor: 'transparent', drawTicks: false }
                }
            }
        };
    }

    ngOnDestroy() {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    }
}
