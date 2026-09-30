import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { SkeletonModule } from 'primeng/skeleton';

export interface KpiItem {
    label: string;
    value: string;
    hint?: string;
    icon: string;
    tone?: 'success' | 'danger' | 'warn' | 'info' | 'neutral';
}

@Component({
    selector: 'app-kpi-grid',
    standalone: true,
    imports: [CommonModule, SkeletonModule],
    template: `
        <div class="grid grid-cols-12 gap-4 w-full mb-6 min-w-0">
        <ng-container *ngIf="loading">
            <div [class]="colClass" *ngFor="let i of placeholders">
                <div class="card mb-0 h-full min-w-0 overflow-hidden">
                    <p-skeleton width="45%" height="0.9rem" styleClass="mb-3" />
                    <p-skeleton width="70%" height="1.75rem" />
                </div>
            </div>
        </ng-container>
        <ng-container *ngIf="!loading">
            <div [class]="colClass" *ngFor="let kpi of items">
                <div class="card mb-0 h-full min-w-0 overflow-hidden">
                    <div class="flex justify-between gap-3 mb-3 min-w-0">
                        <div class="min-w-0 flex-1 overflow-hidden">
                            <span class="block text-muted-color font-medium mb-2 truncate">{{ kpi.label }}</span>
                            <div class="text-surface-900 dark:text-surface-0 font-semibold text-xl xl:text-2xl leading-tight whitespace-nowrap overflow-hidden text-ellipsis">{{ kpi.value }}</div>
                        </div>
                        <div class="flex items-center justify-center rounded-border shrink-0" [ngClass]="fondo(kpi.tone)" style="width: 2.5rem; height: 2.5rem">
                            <i class="text-xl" [ngClass]="[kpi.icon, color(kpi.tone)]"></i>
                        </div>
                    </div>
                    <span class="text-muted-color text-sm leading-snug" *ngIf="kpi.hint">{{ kpi.hint }}</span>
                </div>
            </div>
        </ng-container>
        </div>
    `
})
export class KpiGridComponent {
    @Input() items: KpiItem[] = [];
    @Input() loading = false;
    @Input() columns: 3 | 4 | 6 = 4;

    get placeholders(): number[] {
        return Array.from({ length: this.columns }, (_, i) => i);
    }

    get colClass(): string {
        if (this.columns === 3) {
            return 'col-span-12 sm:col-span-6 lg:col-span-4 min-w-0';
        }
        if (this.columns === 6) {
            return 'col-span-12 sm:col-span-6 lg:col-span-4 min-w-0';
        }
        return 'col-span-12 sm:col-span-6 xl:col-span-3 min-w-0';
    }

    fondo(tone: KpiItem['tone']): string {
        if (tone === 'success') return 'bg-green-100 dark:bg-green-400/10';
        if (tone === 'danger') return 'bg-red-100 dark:bg-red-400/10';
        if (tone === 'warn') return 'bg-orange-100 dark:bg-orange-400/10';
        if (tone === 'info') return 'bg-blue-100 dark:bg-blue-400/10';
        return 'bg-primary-100 dark:bg-primary-400/10';
    }

    color(tone: KpiItem['tone']): string {
        if (tone === 'success') return 'text-green-500';
        if (tone === 'danger') return 'text-red-500';
        if (tone === 'warn') return 'text-orange-500';
        if (tone === 'info') return 'text-blue-500';
        return 'text-primary';
    }
}
