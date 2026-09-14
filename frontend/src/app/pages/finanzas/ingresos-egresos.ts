import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ControlIngresosEgresos } from '../caja/caja.models';
import { CajaService } from '../caja/caja.service';
import { etiquetaCategoria, etiquetaMetodo, etiquetaOrigen, formatBs, formatFechaCorta, formatHora } from '../caja/caja.utils';
import { EstadoVacioComponent } from '../../shared/components/estado-vacio';
import { KpiGridComponent, KpiItem } from '../../shared/components/kpi-grid';

@Component({
    selector: 'app-ingresos-egresos',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, DatePickerModule, TableModule, TagModule, EstadoVacioComponent, KpiGridComponent],
    template: `
        <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
                <div class="text-surface-900 dark:text-surface-0 font-semibold text-2xl mb-1">Control de ingresos y egresos</div>
                <div class="text-muted-color">Resumen consolidado de todo el dinero que entra y sale de la empresa</div>
            </div>
            <div class="flex flex-wrap gap-2 items-end">
                <p-datepicker selectionMode="range" [(ngModel)]="rango" dateFormat="dd/mm/yy" [showIcon]="true" [readonlyInput]="true" placeholder="Período" />
                <p-button label="Consultar" icon="pi pi-search" (onClick)="cargar()" [loading]="cargando" />
            </div>
        </div>

        <div class="grid grid-cols-12 gap-4 mb-6">
            <div class="col-span-12">
                <app-kpi-grid [items]="kpis" [loading]="cargando" [columns]="4" />
            </div>
        </div>

        <div class="card">
            <div class="font-semibold text-xl mb-4">Movimientos</div>
            <p-table [value]="data?.movimientos || []" [loading]="cargando" [paginator]="true" [rows]="12" responsiveLayout="scroll">
                <ng-template #header>
                    <tr>
                        <th>Fecha</th>
                        <th>Hora</th>
                        <th>Tipo</th>
                        <th>Origen</th>
                        <th>Concepto</th>
                        <th>Cliente / Proveedor</th>
                        <th>Método</th>
                        <th>Ingreso</th>
                        <th>Egreso</th>
                        <th>Usuario</th>
                    </tr>
                </ng-template>
                <ng-template #body let-mov>
                    <tr>
                        <td>{{ formatFechaCorta(mov.fecha) }}</td>
                        <td>{{ formatHora(mov.fecha) }}</td>
                        <td><p-tag [value]="mov.tipo" [severity]="mov.tipo === 'INGRESO' ? 'success' : 'danger'" /></td>
                        <td>{{ etiquetaOrigen(mov.origen) }}</td>
                        <td>{{ mov.concepto }}</td>
                        <td>{{ mov.contraparte || '-' }}</td>
                        <td>{{ etiquetaMetodo(mov.metodo_pago) }}</td>
                        <td class="text-green-600 font-medium">{{ mov.ingreso ? formatBs(mov.ingreso) : '-' }}</td>
                        <td class="text-red-500 font-medium">{{ mov.egreso ? formatBs(mov.egreso) : '-' }}</td>
                        <td>{{ mov.usuario?.username || '-' }}</td>
                    </tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr>
                        <td colspan="10">
                            <app-estado-vacio
                                icono="pi pi-wallet"
                                titulo="No existen movimientos registrados"
                                mensaje="Registra una venta, cobranza, pago o gasto para comenzar."
                            />
                        </td>
                    </tr>
                </ng-template>
            </p-table>
        </div>
    `
})
export class IngresosEgresosPage implements OnInit {
    rango: Date[] | null = null;
    data: ControlIngresosEgresos | null = null;
    cargando = false;
    formatBs = formatBs;
    formatHora = formatHora;
    formatFechaCorta = formatFechaCorta;
    etiquetaOrigen = etiquetaOrigen;
    etiquetaMetodo = etiquetaMetodo;
    etiquetaCategoria = etiquetaCategoria;

    constructor(private cajaService: CajaService) {}

    ngOnInit(): void {
        const hoy = new Date();
        this.rango = [new Date(hoy.getFullYear(), hoy.getMonth(), 1), hoy];
        this.cargar();
    }

    get kpis(): KpiItem[] {
        return [
            { label: 'Total ingresos', value: formatBs(this.data?.total_ingresos), icon: 'pi pi-arrow-down-left', tone: 'success', hint: 'Dinero que realmente ingresó' },
            { label: 'Total egresos', value: formatBs(this.data?.total_egresos), icon: 'pi pi-arrow-up-right', tone: 'danger', hint: 'Pagos, gastos y retiros' },
            { label: 'Saldo neto', value: formatBs(this.data?.saldo_neto), icon: 'pi pi-wallet', tone: 'info', hint: 'Ingresos menos egresos' },
            { label: 'Por cobrar', value: formatBs(this.data?.por_cobrar), icon: 'pi pi-clock', tone: 'warn', hint: 'Saldo pendiente de clientes' }
        ];
    }

    cargar(): void {
        this.cargando = true;
        const desde = this.rango?.[0];
        const hasta = this.rango?.[1] || this.rango?.[0];
        this.cajaService.controlIngresosEgresos({
            fecha_desde: desde ? this.ymd(desde) : undefined,
            fecha_hasta: hasta ? this.ymd(hasta) : undefined
        }).subscribe({
            next: (data) => {
                this.data = data;
                this.cargando = false;
            },
            error: () => {
                this.cargando = false;
            }
        });
    }

    private ymd(fecha: Date): string {
        const y = fecha.getFullYear();
        const m = String(fecha.getMonth() + 1).padStart(2, '0');
        const d = String(fecha.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
}
