import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { AvisoService } from '../../shared/services/aviso.service';
import { apiUrl } from '../../core/utils/api-url';
import { formatBs, formatFechaCorta } from '../caja/caja.utils';
import { BotonesExportarComponent } from '../../shared/components/botones-exportar';
import { KpiGridComponent, KpiItem } from '../../shared/components/kpi-grid';
import { TablaBusquedaComponent } from '../../shared/components/tabla-busqueda';
import { TablaEsqueletoComponent } from '../../shared/components/tabla-esqueleto';
import { EstadoVacioComponent } from '../../shared/components/estado-vacio';
import { FILAS_TABLA } from '../../shared/utils/tabla';
import { ClientesService } from '../ventas/ventas.service';
import { Cliente } from '../ventas/ventas.models';

interface DocPorCobrar {
    id: number;
    fecha: string;
    cliente: { id: number; nombre: string } | null;
    total: number;
    cobrado: number;
    saldo: number;
    fecha_vencimiento: string | null;
    dias_atraso: number | null;
    estado: string;
    situacion: string;
    vencida: boolean;
}

@Component({
    selector: 'app-cuentas-por-cobrar',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        DatePickerModule,
        SelectModule,
        TableModule,
        TagModule,
        BotonesExportarComponent,
        KpiGridComponent,
        TablaBusquedaComponent,
        TablaEsqueletoComponent,
        EstadoVacioComponent
    ],
    template: `
        <app-kpi-grid [items]="kpis" [loading]="cargando" [compact]="true" />

        <div class="card">
            <div class="flex flex-wrap items-end gap-3 mb-4">
                <div class="w-full sm:w-[10rem] min-w-0">
                    <label class="block font-bold mb-1 text-sm">Desde</label>
                    <p-datepicker [(ngModel)]="desde" dateFormat="dd/mm/yy" [showIcon]="true" iconDisplay="input" [showButtonBar]="true" fluid />
                </div>
                <div class="w-full sm:w-[10rem] min-w-0">
                    <label class="block font-bold mb-1 text-sm">Hasta</label>
                    <p-datepicker [(ngModel)]="hasta" dateFormat="dd/mm/yy" [showIcon]="true" iconDisplay="input" [showButtonBar]="true" fluid />
                </div>
                <div class="w-full sm:w-[14rem] min-w-0">
                    <label class="block font-bold mb-1 text-sm">Cliente</label>
                    <p-select
                        [options]="clientes"
                        optionLabel="nombre"
                        optionValue="id"
                        [(ngModel)]="idCliente"
                        placeholder="Todos"
                        [showClear]="true"
                        [filter]="true"
                        filterPlaceholder="Buscar"
                        fluid
                    />
                </div>
                <div class="w-full sm:w-[11rem] min-w-0">
                    <label class="block font-bold mb-1 text-sm">Estado</label>
                    <p-select [options]="estados" optionLabel="label" optionValue="value" [(ngModel)]="estado" fluid />
                </div>
                <p-button label="Consultar" icon="pi pi-filter" (onClick)="cargar()" [loading]="cargando" />
                <div class="w-full lg:w-[18rem] min-w-0 lg:ml-auto">
                    <label class="block font-bold mb-1 text-sm">Buscar</label>
                    <app-tabla-busqueda placeholder="Buscar..." [value]="busqueda" (valueChange)="onBuscar($event)" />
                </div>
                <app-botones-exportar
                    tipo="cuentas_por_cobrar"
                    [fechaDesde]="fechaDesde"
                    [fechaHasta]="fechaHasta"
                    [idCliente]="idCliente"
                    [estado]="estado"
                    [q]="busqueda"
                    [disabled]="!visibles.length"
                />
            </div>
            <p-table
                [value]="cargando ? [] : visibles"
                [loading]="cargando"
                [showLoader]="false"
                [paginator]="true"
                [alwaysShowPaginator]="true"
                [rows]="10"
                [rowsPerPageOptions]="filasTabla"
                [first]="pagina"
                (onPage)="pagina = $event.first"
                [showCurrentPageReport]="true"
                currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} documentos"
                [rowHover]="true"
                sortMode="single"
                responsiveLayout="scroll"
            >
                <ng-template #header>
                    <tr>
                        <th pSortableColumn="fecha">Fecha <p-sortIcon field="fecha" /></th>
                        <th pSortableColumn="id">N° Venta <p-sortIcon field="id" /></th>
                        <th pSortableColumn="cliente.nombre">Cliente <p-sortIcon field="cliente.nombre" /></th>
                        <th pSortableColumn="total">Total <p-sortIcon field="total" /></th>
                        <th pSortableColumn="cobrado">Cobrado <p-sortIcon field="cobrado" /></th>
                        <th pSortableColumn="saldo">Saldo <p-sortIcon field="saldo" /></th>
                        <th pSortableColumn="fecha_vencimiento">Vencimiento <p-sortIcon field="fecha_vencimiento" /></th>
                        <th pSortableColumn="dias_atraso">Días de atraso <p-sortIcon field="dias_atraso" /></th>
                        <th pSortableColumn="estado">Estado <p-sortIcon field="estado" /></th>
                    </tr>
                </ng-template>
                <ng-template #body let-doc>
                    <tr>
                        <td>{{ formatFechaCorta(doc.fecha) }}</td>
                        <td>#{{ doc.id }}</td>
                        <td>{{ doc.cliente?.nombre || '-' }}</td>
                        <td>{{ formatBs(doc.total) }}</td>
                        <td>{{ formatBs(doc.cobrado) }}</td>
                        <td class="font-medium">{{ formatBs(doc.saldo) }}</td>
                        <td>{{ doc.fecha_vencimiento ? formatFechaCorta(doc.fecha_vencimiento) : 'Sin plazo' }}</td>
                        <td>{{ doc.dias_atraso == null ? '-' : doc.dias_atraso }}</td>
                        <td><p-tag [value]="etiquetaEstado(doc)" [severity]="severidad(doc)" /></td>
                    </tr>
                </ng-template>
                <ng-template #footer>
                    <tr *ngIf="visibles.length">
                        <td colspan="3" class="font-semibold">Totales del resultado</td>
                        <td class="font-semibold">{{ formatBs(totales.vendido) }}</td>
                        <td class="font-semibold">{{ formatBs(totales.cobrado) }}</td>
                        <td class="font-semibold">{{ formatBs(totales.pendiente) }}</td>
                        <td colspan="3"></td>
                    </tr>
                </ng-template>
                <ng-template #loadingbody>
                    <tr *ngFor="let f of [0,1,2,3,4,5]" app-tabla-esqueleto [columnas]="9" [fila]="f"></tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr>
                        <td colspan="9">
                            <app-estado-vacio icono="pi pi-check-circle" titulo="Sin documentos" mensaje="No hay ventas que coincidan con estos filtros." />
                        </td>
                    </tr>
                </ng-template>
            </p-table>
        </div>
    `
})
export class CuentasPorCobrarPage implements OnInit {
    filasTabla = FILAS_TABLA;
    formatBs = formatBs;
    formatFechaCorta = formatFechaCorta;
    desde: Date | null = null;
    hasta: Date | null = null;
    idCliente: number | null = null;
    busqueda = '';
    estado = 'CON_SALDO';
    estados = [
        { label: 'Con saldo', value: 'CON_SALDO' },
        { label: 'Vencidas', value: 'VENCIDAS' },
        { label: 'Por vencer', value: 'POR_VENCER' },
        { label: 'Todas', value: 'TODAS' }
    ];
    clientes: Cliente[] = [];
    documentos: DocPorCobrar[] = [];
    pagina = 0;
    cargando = false;

    constructor(private http: HttpClient, private clientesService: ClientesService, private aviso: AvisoService) {}

    ngOnInit(): void {
        this.clientesService.listar({ activos: 'todos' }).subscribe({
            next: (data) => (this.clientes = data),
            error: (err) => this.aviso.error(err, 'No se pudieron cargar clientes')
        });
        this.cargar();
    }

    get fechaDesde(): string | undefined {
        return this.desde ? this.ymd(this.desde) : undefined;
    }

    get fechaHasta(): string | undefined {
        return this.hasta ? this.ymd(this.hasta) : undefined;
    }

    get visibles(): DocPorCobrar[] {
        const q = this.busqueda.trim().toLowerCase();
        if (!q) {
            return this.documentos;
        }
        return this.documentos.filter((doc) => this.textoDoc(doc).includes(q));
    }

    get totales() {
        return {
            vendido: this.visibles.reduce((acc, d) => acc + Number(d.total || 0), 0),
            cobrado: this.visibles.reduce((acc, d) => acc + Number(d.cobrado || 0), 0),
            pendiente: this.visibles.reduce((acc, d) => acc + Number(d.saldo || 0), 0)
        };
    }

    onBuscar(valor: string): void {
        this.busqueda = valor;
        this.pagina = 0;
    }

    get kpis(): KpiItem[] {
        const hint = this.busqueda.trim()
            ? `${this.visibles.length} de ${this.documentos.length} documentos`
            : `${this.visibles.length} documentos`;
        return [
            { label: 'Vendido a crédito', value: formatBs(this.totales.vendido), icon: 'pi pi-shopping-cart', tone: 'info', hint },
            { label: 'Cobrado', value: formatBs(this.totales.cobrado), icon: 'pi pi-wallet', tone: 'success', hint },
            { label: 'Pendiente', value: formatBs(this.totales.pendiente), icon: 'pi pi-clock', tone: 'warn', hint }
        ];
    }

    cargar(): void {
        this.cargando = true;
        const params: Record<string, string> = { estado: this.estado };
        if (this.fechaDesde) params['fecha_desde'] = this.fechaDesde;
        if (this.fechaHasta) params['fecha_hasta'] = this.fechaHasta;
        if (this.idCliente) params['id_cliente'] = String(this.idCliente);
        this.http.get<{ documentos: DocPorCobrar[]; totales: { vendido: number; cobrado: number; pendiente: number } }>(
            apiUrl('/api/reportes/cuentas-por-cobrar'),
            { params }
        ).subscribe({
            next: (data) => {
                this.documentos = data.documentos || [];
                this.pagina = 0;
                this.cargando = false;
            },
            error: (err) => {
                this.cargando = false;
                this.aviso.error(err, 'No se pudo generar el reporte');
            }
        });
    }

    private textoDoc(doc: DocPorCobrar): string {
        return [
            doc.id,
            `#${doc.id}`,
            doc.cliente?.nombre,
            doc.estado,
            this.etiquetaEstado(doc),
            doc.situacion,
            this.formatFechaCorta(doc.fecha),
            doc.fecha_vencimiento ? this.formatFechaCorta(doc.fecha_vencimiento) : 'Sin plazo',
            doc.dias_atraso == null ? '-' : doc.dias_atraso,
            doc.total,
            doc.cobrado,
            doc.saldo,
            this.formatBs(doc.total),
            this.formatBs(doc.cobrado),
            this.formatBs(doc.saldo)
        ].join(' ').toLowerCase();
    }

    etiquetaEstado(doc: DocPorCobrar): string {
        return doc.vencida ? 'VENCIDA' : doc.estado;
    }

    severidad(doc: DocPorCobrar): 'danger' | 'warn' | 'success' | 'info' {
        if (doc.vencida) return 'danger';
        if (doc.estado === 'PAGADA') return 'success';
        if (doc.estado === 'PARCIAL') return 'warn';
        return 'info';
    }

    private ymd(d: Date): string {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }
}
