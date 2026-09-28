import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ControlIngresosEgresos, MovimientoResumen } from '../caja/caja.models';
import { CajaService } from '../caja/caja.service';
import { METODOS_PAGO_OPTIONS, ORIGEN_MOVIMIENTO_OPTIONS, TIPOS_MOVIMIENTO_OPTIONS } from '../caja/caja.constants';
import { etiquetaCategoria, etiquetaMetodo, etiquetaOrigen, formatBs, formatFechaCorta, formatHora } from '../caja/caja.utils';
import { EstadoVacioComponent } from '../../shared/components/estado-vacio';
import { KpiGridComponent, KpiItem } from '../../shared/components/kpi-grid';
import { BotonesExportarComponent } from '../../shared/components/botones-exportar';
import { TablaEsqueletoComponent } from '../../shared/components/tabla-esqueleto';
import { AyudaCampoComponent } from '../../shared/components/ayuda-campo';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { APP_ROUTES } from '../../core/constants/app-routes';

@Component({
    selector: 'app-ingresos-egresos',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterModule, ButtonModule, DatePickerModule, SelectModule, TableModule, TagModule, ToastModule, EstadoVacioComponent, KpiGridComponent, BotonesExportarComponent, TablaEsqueletoComponent, AyudaCampoComponent, TooltipModule],
    providers: [MessageService],
    template: `
        <p-toast />
        <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
                <div class="text-surface-900 dark:text-surface-0 font-semibold text-2xl mb-1">Control de ingresos y egresos</div>
                <div class="text-muted-color">Resumen consolidado de todo el dinero que entra y sale de la empresa</div>
            </div>
            <div class="flex flex-wrap gap-2 items-end">
                <p-datepicker selectionMode="range" [(ngModel)]="rango" dateFormat="dd/mm/yy" [showIcon]="true" [readonlyInput]="true" placeholder="Período" />
                <p-button label="Consultar" icon="pi pi-search" (onClick)="cargar()" [loading]="cargando" />
                <app-botones-exportar tipo="movimientos" [fechaDesde]="fechaDesde" [fechaHasta]="fechaHasta" />
            </div>
        </div>

        <div class="grid grid-cols-12 gap-4 mb-6">
            <div class="col-span-12">
                <app-kpi-grid [items]="kpis" [loading]="cargando" [columns]="3" />
            </div>
        </div>

        <div class="card">
            <div class="font-semibold text-xl mb-4">Movimientos</div>
            <div class="grid grid-cols-12 gap-3 mb-4">
                <div class="col-span-12 md:col-span-4">
                    <label class="flex items-center gap-1 font-bold mb-2">Tipo <app-ayuda-campo texto="Ingreso: dinero que entra. Egreso: dinero que sale. Una venta a crédito no aparece hasta el cobro." posicion="bottom" /></label>
                    <p-select [options]="tiposFiltro" optionLabel="label" optionValue="value" [(ngModel)]="filtroTipo" placeholder="Todos" [showClear]="true" fluid />
                </div>
                <div class="col-span-12 md:col-span-4">
                    <label class="flex items-center gap-1 font-bold mb-2">Origen <app-ayuda-campo texto="De dónde nació el movimiento: venta, cobranza, gasto, pago, manual, etc." posicion="bottom" /></label>
                    <p-select [options]="origenesFiltro" optionLabel="label" optionValue="value" [(ngModel)]="filtroOrigen" placeholder="Todos" [showClear]="true" fluid />
                </div>
                <div class="col-span-12 md:col-span-4">
                    <label class="flex items-center gap-1 font-bold mb-2">Método <app-ayuda-campo texto="Efectivo, QR, transferencia u otro." posicion="left" /></label>
                    <p-select [options]="metodosFiltro" optionLabel="label" optionValue="value" [(ngModel)]="filtroMetodo" placeholder="Todos" [showClear]="true" fluid />
                </div>
            </div>
            <p-table [value]="cargando ? [] : movimientosFiltrados" [loading]="cargando" [showLoader]="false" [paginator]="true" [rows]="12" responsiveLayout="scroll">
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
                        <th></th>
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
                        <td>
                            <p-button
                                *ngIf="rutaOrigen(mov)"
                                icon="pi pi-external-link"
                                [rounded]="true"
                                [outlined]="true"
                                [routerLink]="rutaOrigen(mov)"
                                [queryParams]="queryOrigen(mov)"
                                pTooltip="Abrir el documento de origen"
                                tooltipPosition="left"
                            />
                        </td>
                    </tr>
                </ng-template>
                <ng-template #loadingbody>
                    <tr *ngFor="let f of [0,1,2,3,4,5,6,7]" app-tabla-esqueleto [columnas]="11" [fila]="f"></tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr>
                        <td colspan="11">
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
    filtroTipo = '';
    filtroOrigen = '';
    filtroMetodo = '';
    tiposFiltro = TIPOS_MOVIMIENTO_OPTIONS;
    origenesFiltro = ORIGEN_MOVIMIENTO_OPTIONS;
    metodosFiltro = METODOS_PAGO_OPTIONS;
    formatBs = formatBs;
    formatHora = formatHora;
    formatFechaCorta = formatFechaCorta;
    etiquetaOrigen = etiquetaOrigen;
    etiquetaMetodo = etiquetaMetodo;
    etiquetaCategoria = etiquetaCategoria;

    constructor(private cajaService: CajaService) {}

    get fechaDesde(): string | undefined {
        return this.rango?.[0] ? this.ymd(this.rango[0]) : undefined;
    }

    get fechaHasta(): string | undefined {
        const hasta = this.rango?.[1] || this.rango?.[0];
        return hasta ? this.ymd(hasta) : undefined;
    }

    ngOnInit(): void {
        const hoy = new Date();
        this.rango = [new Date(hoy.getFullYear(), hoy.getMonth(), 1), hoy];
        this.cargar();
    }

    get kpis(): KpiItem[] {
        return [
            { label: 'Total ingresos', value: formatBs(this.data?.total_ingresos), icon: 'pi pi-arrow-down-left', tone: 'success', hint: 'Dinero que realmente ingresó' },
            { label: 'Total egresos', value: formatBs(this.data?.total_egresos), icon: 'pi pi-arrow-up-right', tone: 'danger', hint: 'Pagos, gastos, retiros y devoluciones por anulación' },
            { label: 'Saldo neto', value: formatBs(this.data?.saldo_neto), icon: 'pi pi-wallet', tone: 'info', hint: 'Ingresos menos egresos' },
            { label: 'Cobrado', value: formatBs(this.data?.cobrado), icon: 'pi pi-money-bill', tone: 'success', hint: 'Cobros menos anulaciones del período' },
            { label: 'Por cobrar', value: formatBs(this.data?.por_cobrar), icon: 'pi pi-clock', tone: 'warn', hint: 'Saldo pendiente de clientes' },
            { label: 'Por pagar', value: formatBs(this.data?.por_pagar), icon: 'pi pi-send', tone: 'warn', hint: 'Saldo pendiente a proveedores' }
        ];
    }

    get movimientosFiltrados(): MovimientoResumen[] {
        return (this.data?.movimientos || []).filter((mov) => {
            if (this.filtroTipo && mov.tipo !== this.filtroTipo) {
                return false;
            }
            if (this.filtroOrigen && mov.origen !== this.filtroOrigen) {
                return false;
            }
            if (this.filtroMetodo && mov.metodo_pago !== this.filtroMetodo) {
                return false;
            }
            return true;
        });
    }

    rutaOrigen(mov: MovimientoResumen): string | null {
        switch (mov.origen) {
            case 'VENTA':
                return APP_ROUTES.ventas;
            case 'COBRANZA':
                return APP_ROUTES.cobranzas;
            case 'PAGO_PROVEEDOR':
                return APP_ROUTES.pagos;
            case 'GASTO':
                return mov.categoria === 'RETIRO_PERSONAL' ? APP_ROUTES.retiros : APP_ROUTES.gastos;
            case 'COMPRA':
                return APP_ROUTES.compras;
            case 'MANUAL':
                return APP_ROUTES.caja;
            default:
                return null;
        }
    }

    queryOrigen(mov: MovimientoResumen): Record<string, number> {
        if (mov.origen !== 'VENTA') {
            return {};
        }
        const match = String(mov.concepto || '').match(/venta #(\d+)/i);
        const id = match ? Number(match[1]) : Number(mov.origen_id || 0);
        return id ? { id } : {};
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
