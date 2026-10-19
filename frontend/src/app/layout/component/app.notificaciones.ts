import { Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Popover, PopoverModule } from 'primeng/popover';
import { catchError, exhaustMap, filter, forkJoin, merge, of, Subject, tap, timer } from 'rxjs';
import { VentasService } from '../../pages/ventas/ventas.service';
import { Venta } from '../../pages/ventas/ventas.models';
import { APP_ROUTES } from '../../core/constants/app-routes';
import { formatBs } from '../../shared/utils/money';

@Component({
    selector: 'app-notificaciones',
    standalone: true,
    imports: [CommonModule, RouterModule, PopoverModule],
    template: `
        <button type="button" class="layout-topbar-action campana"
            [attr.aria-label]="error() ? 'Notificaciones: no se pudieron consultar las cuentas' : 'Notificaciones: ' + cuentas().length + ' cuentas pendientes por cobrar'"
            title="Cuentas por cobrar" aria-haspopup="dialog"
            (click)="abrir($event, panel)">
            <i class="pi pi-bell" aria-hidden="true"></i>
            <span *ngIf="cuentas().length && !error()" class="contador" aria-hidden="true">
                {{ cuentas().length > 99 ? '99+' : cuentas().length }}
            </span>
            <span *ngIf="error()" class="contador" aria-hidden="true">!</span>
        </button>
        <p-popover #panel [style]="{ width: 'min(23rem, calc(100vw - 2rem))' }">
            <section aria-label="Notificaciones de cobranza">
                <div class="flex items-center justify-between gap-3 mb-2">
                    <strong>Cuentas por cobrar</strong>
                    <button type="button" class="layout-topbar-action" aria-label="Actualizar notificaciones"
                        [disabled]="cargando()" (click)="actualizar.next()">
                        <i class="pi pi-refresh" [class.pi-spin]="cargando()" aria-hidden="true"></i>
                    </button>
                </div>
                <p *ngIf="error()" role="status" class="text-color-secondary mb-3">
                    No se pudieron consultar las cuentas. Intenta actualizar.
                </p>
                <ng-container *ngIf="!error()">
                    <p class="text-sm text-color-secondary mb-3" aria-live="polite">
                        {{ cuentas().length }} pendientes · {{ vencidas() }} vencidas · {{ proximas() }} vencen en 7 días o menos
                    </p>
                    <p *ngIf="!cuentas().length" class="text-color-secondary py-3" role="status">
                        {{ cargando() ? 'Consultando cuentas…' : 'No hay cuentas pendientes por cobrar.' }}
                    </p>
                    <div class="lista">
                        <a *ngFor="let venta of cuentas().slice(0, 5)" [routerLink]="ruta"
                            (click)="panel.hide()" class="aviso">
                            <div class="flex justify-between gap-3">
                                <strong>{{ venta.cliente?.nombre || 'Cliente' }}</strong>
                                <strong class="whitespace-nowrap">{{ formatBs(venta.saldo_pendiente) }}</strong>
                            </div>
                            <div class="text-sm text-color-secondary mt-1">
                                Venta #{{ venta.id }} · {{ situacion(venta) }}
                            </div>
                        </a>
                    </div>
                </ng-container>
                <a [routerLink]="ruta" (click)="panel.hide()" class="ver-todas">Ver todas en Cobranzas →</a>
            </section>
        </p-popover>
    `,
    styles: [`
        :host { display: inline-flex; }
        .campana { position: relative; }
        .contador { position: absolute; top: -3px; right: -5px; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 12px; background: #b21f2d; color: white; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
        .lista { max-height: 320px; overflow-y: auto; }
        .aviso { display: block; padding: 12px 4px; border-bottom: 1px solid var(--surface-border); color: var(--text-color); border-radius: 4px; }
        .aviso:hover, .aviso:focus-visible { background: var(--surface-hover); }
        .ver-todas { display: block; margin-top: 16px; color: var(--primary-color); font-weight: 600; }
    `]
})
export class AppNotificaciones {
    private ventas = inject(VentasService);
    private router = inject(Router);
    private destroyRef = inject(DestroyRef);
    readonly actualizar = new Subject<void>();
    readonly cuentas = signal<Venta[]>([]);
    readonly error = signal(false);
    readonly cargando = signal(true);
    readonly ruta = APP_ROUTES.cobranzas;
    readonly formatBs = formatBs;
    readonly vencidas = () => this.cuentas().filter(v => v.situacion === 'VENCIDA').length;
    readonly proximas = () => this.cuentas().filter(v => v.situacion === 'VENCE HOY' || v.situacion === 'POR VENCER').length;

    constructor() {
        merge(timer(0, 60000), this.actualizar,
            this.router.events.pipe(filter(event => event instanceof NavigationEnd)))
            .pipe(
                tap(() => this.cargando.set(true)),
                exhaustMap(() => forkJoin([
                    this.ventas.listar({ estado: 'PENDIENTE' }),
                    this.ventas.listar({ estado: 'PARCIAL' })
                ]).pipe(catchError(() => of(null)))),
                takeUntilDestroyed(this.destroyRef)
            ).subscribe(resultado => {
                this.cargando.set(false);
                this.error.set(resultado === null);
                if (!resultado) return;
                this.cuentas.set(resultado.flat()
                    .filter(v => Number(v.saldo_pendiente) > 0)
                    .sort((a, b) => (a.dias_vencimiento ?? Infinity) - (b.dias_vencimiento ?? Infinity) || a.id - b.id));
            });
    }

    abrir(event: Event, panel: Popover): void {
        panel.toggle(event);
        this.actualizar.next();
    }

    situacion(venta: Venta): string {
        const dias = venta.dias_vencimiento;
        if (dias === null || dias === undefined) return 'Pendiente sin fecha de vencimiento';
        if (dias < 0) return `Vencida hace ${Math.abs(dias)} días`;
        if (dias === 0) return 'Vence hoy';
        return `Vence en ${dias} días`;
    }
}
