import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { MultiSelectModule } from 'primeng/multiselect';
import { TableModule } from 'primeng/table';
import { Table } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { AvisoService } from '../../shared/services/aviso.service';
import { Cliente, Venta } from '../ventas/ventas.models';
import { ClientesService } from '../ventas/ventas.service';
import { colorDespacho, DespachosService, etiquetaDespacho, FiltroDespachos } from './despachos.service';
import { DespachoFormComponent } from './despacho-form';
import { TablaEsqueletoComponent } from '../../shared/components/tabla-esqueleto';

@Component({
    selector: 'app-despachos',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, MultiSelectModule, TableModule, TagModule, DatePickerModule, InputTextModule, DespachoFormComponent, TablaEsqueletoComponent],
    template: ` <div class="flex flex-wrap justify-between gap-4 mb-6">
            <div>
                <h1 class="text-2xl font-semibold m-0">Despachos</h1>
                <p class="text-muted-color mt-1 mb-0">Productos vendidos y pendientes de retiro</p>
            </div>
            <div class="flex gap-2">
                <p-button icon="pi pi-file-excel" label="Excel" [outlined]="true" [disabled]="cargando" (onClick)="exportar('xlsx')" /><p-button icon="pi pi-file-pdf" label="PDF" [outlined]="true" [disabled]="cargando" (onClick)="exportar('pdf')" />
            </div>
        </div>
        <div *ngIf="!habilitado" class="mb-4 text-muted-color">El registro de despachos está pendiente de activación.</div>
            <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[minmax(9rem,1fr)_minmax(15rem,1.4fr)_minmax(13rem,1.2fr)_minmax(8rem,1fr)_auto] gap-4 mb-5">
            <div><label class="block font-bold mb-2">Cliente</label><p-multiselect [options]="clientes" optionLabel="nombre" optionValue="id" [(ngModel)]="cliente" [showClear]="true" [filter]="true" placeholder="Todos" display="chip" fluid appendTo="body" /></div>
            <div><label class="block font-bold mb-2">Estado de despacho</label><p-multiselect [options]="estados" optionLabel="label" optionValue="value" [(ngModel)]="estado" placeholder="Todos" display="chip" [filter]="true" [showClear]="true" fluid appendTo="body" /></div>
            <div><label class="block font-bold mb-2">Fecha de venta</label><p-datepicker [(ngModel)]="rango" selectionMode="range" [showIcon]="true" dateFormat="dd/mm/yy" [showClear]="true" fluid appendTo="body" /></div>
            <div><label class="block font-bold mb-2">Número de venta</label><input pInputText type="number" min="1" class="w-full" [(ngModel)]="numero" (keyup.enter)="consultar()" /></div>
            <div class="flex items-end"><p-button label="Consultar" icon="pi pi-search" (onClick)="consultar()" /></div>
        </div>
        <div class="card">
        <p-table
            #dt
            styleClass="despachos-table"
            [showGridlines]="false"
            [tableStyle]="{ 'min-width': '65rem' }"
            [value]="cargando ? [] : ventas"
            [loading]="cargando"
            [showLoader]="false"
            dataKey="id"
            [expandedRowKeys]="expandedRows"
            [lazy]="true"
            (onLazyLoad)="paginar($event)"
            [paginator]="true"
            [rows]="limite"
            [first]="primero"
            [totalRecords]="total"
            [rowsPerPageOptions]="[10, 25, 50]"
            [sortField]="sortField"
            [sortOrder]="sortOrder"
            [defaultSortOrder]="-1"
            sortMode="single"
            [showCurrentPageReport]="true"
            currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} ventas"
            responsiveLayout="scroll"
        >
            <ng-template #caption>
                <div class="flex justify-end">
                    <p-button [label]="todasExpandida ? 'Colapsar todo' : 'Expandir todo'" [icon]="todasExpandida ? 'pi pi-minus' : 'pi pi-plus'" [outlined]="true" size="small" [disabled]="!ventas.length || cargando" (onClick)="alternarTodas()" />
                </div>
            </ng-template>
            <ng-template #header
                ><tr class="despacho-header-row">
                    <th style="width: 3.5rem"></th>
                    <th pSortableColumn="id" style="width: 7rem">Venta <p-sortIcon field="id" /></th>
                    <th pSortableColumn="fecha" style="width: 9rem">Fecha <p-sortIcon field="fecha" /></th>
                    <th pSortableColumn="cliente">Cliente <p-sortIcon field="cliente" /></th>
                    <th pSortableColumn="estado" style="width: 12rem">Estado de pago <p-sortIcon field="estado" /></th>
                    <th pSortableColumn="estado_despacho" style="width: 13rem">Estado de despacho <p-sortIcon field="estado_despacho" /></th>
                    <th style="width: 23rem">Acciones</th>
                </tr></ng-template
            >
            <ng-template #body let-v let-expanded="expanded">
                <tr class="despacho-sale-row" [class.despacho-sale-expanded]="expanded">
                    <td><button pButton type="button" [pRowToggler]="v" class="p-button-text p-button-rounded p-button-plain" [icon]="expanded ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" [attr.aria-label]="expanded ? 'Ocultar productos' : 'Mostrar productos'"></button></td>
                    <td class="despacho-sale-number">{{ v.id }}</td>
                    <td>{{ v.fecha | date: 'dd/MM/yyyy' }}</td>
                    <td>{{ v.cliente?.nombre }}</td>
                    <td><p-tag [value]="v.estado === 'PARCIAL' ? 'Pago parcial' : v.estado === 'PAGADA' ? 'Pagada' : v.estado === 'PENDIENTE' ? 'Pendiente' : v.estado" [icon]="v.estado === 'PAGADA' ? 'pi pi-check-circle' : 'pi pi-clock'" [severity]="v.estado === 'PAGADA' ? 'success' : 'warn'" /></td>
                    <td><p-tag [value]="etiqueta(v.estado_despacho)" [icon]="v.estado_despacho === 'COMPLETO' ? 'pi pi-check-circle' : v.estado_despacho === 'PARCIAL' ? 'pi pi-truck' : 'pi pi-clock'" [severity]="color(v.estado_despacho)" /></td>
                    <td>
                        <div class="flex gap-2 whitespace-nowrap">
                            <p-button *ngIf="habilitado && (v.estado_despacho === 'PENDIENTE' || v.estado_despacho === 'PARCIAL')" label="Registrar despacho" icon="pi pi-truck" size="small" (onClick)="form.abrir(v)" /><p-button
                                icon="pi pi-history"
                                label="Historial"
                                size="small"
                                [outlined]="true"
                                ariaLabel="Historial de despachos"
                                (onClick)="form.abrir(v, true)"
                            />
                        </div>
                    </td>
                </tr>
            </ng-template>
            <ng-template #expandedrow let-v>
                <tr>
                    <td colspan="7" class="despacho-expansion-cell">
                        <div class="despacho-detail-wrapper">
                            <div class="despacho-detail-gutter" aria-hidden="true"></div>
                            <table class="despacho-detail-table" [attr.aria-label]="'Productos de la venta ' + v.id">
                                <thead><tr class="despacho-detail-header">
                                    <th scope="col" style="width: 38%">Producto</th>
                                    <th scope="col" style="width: 17%">Unidad</th>
                                    <th scope="col" class="despacho-numeric" style="width: 15%">Vendido</th>
                                    <th scope="col" class="despacho-numeric" style="width: 15%">Entregado</th>
                                    <th scope="col" class="despacho-numeric" style="width: 15%">Por entregar</th>
                                </tr></thead>
                                <tbody><tr *ngFor="let l of productos(v)" class="despacho-detail-row">
                                    <td>{{ l.descripcion }}</td>
                                    <td>{{ l.unidad }}</td>
                                    <td class="despacho-numeric">{{ l.cantidad }}</td>
                                    <td class="despacho-numeric">{{ l.entregado }}</td>
                                    <td class="despacho-numeric"><span [class.despacho-pending]="(l.pendiente ?? 0) > 0">{{ l.pendiente }}</span></td>
                                </tr>
                                <tr *ngIf="!productos(v).length" class="despacho-detail-row">
                                    <td colspan="5">Sin productos físicos.</td>
                                </tr></tbody>
                                <tfoot>
                                    <tr class="despacho-detail-summary" *ngIf="v.estado_despacho === 'COMPLETO' || resumenPendiente(v)">
                                        <td colspan="5">
                                            <div class="flex items-center gap-2 font-normal">
                                                <i [class]="v.estado_despacho === 'COMPLETO' ? 'pi pi-check-circle text-green-600' : 'pi pi-exclamation-circle text-yellow-600'" aria-hidden="true"></i>
                                                <span>{{ v.estado_despacho === 'COMPLETO' ? 'Entrega completa' : 'Pendiente: ' + resumenPendiente(v) }}</span>
                                            </div>
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </td>
                </tr>
            </ng-template>
            <ng-template #loadingbody>
                <tr *ngFor="let fila of [0, 1, 2, 3, 4, 5, 6, 7]" app-tabla-esqueleto [columnas]="7" [fila]="fila"></tr>
            </ng-template>
            <ng-template #emptymessage
                ><tr>
                    <td colspan="7" class="text-center py-8 text-muted-color">No hay ventas para estos filtros.</td>
                </tr></ng-template
            >
        </p-table>
        </div>
        <app-despacho-form #form (confirmado)="cargar()" />`,
    styles: [`
        :host ::ng-deep .despachos-table > .p-datatable-header {
            padding: .35rem 0 .65rem;
            background: transparent;
            border: 0;
        }
        .despacho-header-row > th {
            background: var(--p-content-hover-background, #f1f5f9);
            padding: .8rem 1rem;
            font-size: .95rem;
            font-weight: 700;
            text-align: left;
            white-space: nowrap;
            border: 0;
            border-bottom: 1px solid var(--p-content-border-color, #dce3ec);
        }
        .despacho-sale-row > td {
            background: var(--p-content-background, #fff);
            padding: .35rem .75rem;
            font-size: 1rem;
            vertical-align: middle;
            border: 0;
            border-bottom: 1px solid var(--p-content-border-color, #dce3ec);
            overflow-wrap: anywhere;
        }
        .despacho-sale-expanded > td {
            background: var(--p-content-hover-background, #f1f5f9);
        }
        .despacho-sale-number {
            font-weight: 700;
            font-variant-numeric: tabular-nums;
        }
        :host ::ng-deep .despachos-table .p-tag {
            gap: .5rem;
            padding: .3rem .65rem;
            white-space: nowrap;
        }
        .despacho-expansion-cell {
            padding: 0 !important;
            border: 0;
        }
        .despacho-detail-wrapper {
            display: grid;
            grid-template-columns: 3.5rem minmax(0, 1fr);
        }
        .despacho-detail-gutter {
            background: var(--p-content-hover-background, #f1f5f9);
            border-right: 1px solid var(--p-content-border-color, #dce3ec);
            border-bottom: 1px solid var(--p-content-border-color, #dce3ec);
        }
        .despacho-detail-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
        }
        .despacho-detail-header > th {
            font-size: .9rem;
            font-weight: 600;
            text-align: left;
            padding: .6rem 1rem;
            background: var(--p-content-background, #fff);
            border: 0;
            border-bottom: 1px solid var(--p-content-border-color, #dce3ec);
        }
        .despacho-detail-row > td, .despacho-detail-summary > td {
            padding: .65rem 1rem;
            font-size: 1rem;
            background: var(--p-content-background, #fff);
            border: 0;
            border-bottom: 1px solid var(--p-content-border-color, #dce3ec);
            overflow-wrap: anywhere;
        }
        .despacho-detail-row:nth-child(even) > td {
            background: var(--p-content-hover-background, #f1f5f9);
        }
        .despacho-detail-header > .despacho-numeric,
        .despacho-detail-row > .despacho-numeric {
            text-align: center;
            font-variant-numeric: tabular-nums;
        }
        .despacho-pending {
            display: inline-block;
            min-width: 2.5rem;
            padding: .2rem .5rem;
            border-radius: 4px;
            background: var(--p-yellow-100, #fef9c3);
            color: var(--p-yellow-950, #422006);
            font-weight: 700;
        }
        :host ::ng-deep .despachos-table .p-paginator {
            justify-content: flex-end;
            padding: .65rem 0;
        }
        :host ::ng-deep .despachos-table .p-paginator-current {
            margin-right: auto;
        }
    `]
})
export class DespachosComponent implements OnInit {
    clientes: Cliente[] = [];
    ventas: Venta[] = [];
    total = 0;
    cargando = false;
    habilitado = false;
    cliente: number[] = [];
    numero: number | null = null;
    rango: Date[] | null = null;
    estado: string[] = ['PENDIENTE', 'PARCIAL'];
    primero = 0;
    limite = 10;
    expandedRows: Record<string, boolean> = {};
    @ViewChild('dt') tabla!: Table;
    sortField = 'fecha';
    sortOrder: 1 | -1 = -1;
    filtros: FiltroDespachos = { estado_despacho: ['PENDIENTE', 'PARCIAL'] };
    secuencia = 0;
    etiqueta = etiquetaDespacho;
    color = colorDespacho;
    get todasExpandida(): boolean {
        return this.ventas.length > 0 && this.ventas.every((venta) => this.expandedRows[String(venta.id)]);
    }
    estados = [
        { label: 'Pendiente', value: 'PENDIENTE' },
        { label: 'Parcial', value: 'PARCIAL' },
        { label: 'Completo', value: 'COMPLETO' },
        { label: 'No aplica', value: 'NO_APLICA' }
    ];
    constructor(
        private servicio: DespachosService,
        private clientesService: ClientesService,
        private aviso: AvisoService
    ) {}
    ngOnInit() {
        this.servicio.config().subscribe({ next: (r) => (this.habilitado = r.habilitado) });
        this.clientesService.listar().subscribe({ next: (r) => (this.clientes = r) });
    }
    private ymd(d: Date) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    consultar() {
        this.filtros = {
            estado_despacho: this.estado.length ? this.estado : undefined,
            id_cliente: this.cliente.length ? this.cliente : undefined,
            numero: this.numero || undefined,
            fecha_desde: this.rango?.[0] ? this.ymd(this.rango[0]) : undefined,
            fecha_hasta: this.rango?.[0] ? this.ymd(this.rango[1] || this.rango[0]) : undefined,
            sortField: this.sortField,
            sortOrder: this.sortOrder
        };
        this.primero = 0;
        this.expandedRows = {};
        this.cargar();
    }
    paginar(e: any) {
        this.primero = e.first || 0;
        this.limite = e.rows || 10;
        this.sortField = e.sortField || this.sortField;
        this.sortOrder = e.sortOrder === 1 ? 1 : -1;
        this.filtros = { ...this.filtros, sortField: this.sortField, sortOrder: this.sortOrder };
        this.cargar();
    }
    cargar() {
        const id = ++this.secuencia;
        this.cargando = true;
        this.expandedRows = {};
        this.servicio.listar(this.filtros, Math.floor(this.primero / this.limite) + 1, this.limite).subscribe({
            next: (r) => {
                if (id !== this.secuencia) return;
                this.ventas = r.data;
                this.total = r.total;
                this.cargando = false;
            },
            error: (e) => {
                if (id !== this.secuencia) return;
                this.cargando = false;
                this.aviso.error(e, 'No se pudieron cargar los despachos');
            }
        });
    }
    productos(v: Venta) {
        return (v.detalles || []).filter((l) => l.id_producto);
    }
    resumenPendiente(v: Venta): string {
        return this.productos(v)
            .filter((l) => Number(l.pendiente) > 0)
            .map((l) => `${l.pendiente} ${l.unidad || 'unidades'} de ${l.descripcion}`)
            .join('; ');
    }
    alternarTodas() {
        const expandir = !this.todasExpandida;
        for (const venta of this.ventas) {
            if (this.tabla.isRowExpanded(venta) !== expandir) this.tabla.toggleRow(venta);
        }
        this.expandedRows = { ...this.tabla.expandedRowKeys };
    }
    exportar(formato: 'pdf' | 'xlsx') {
        this.servicio.exportar(this.filtros, formato).subscribe({ next: (b) => this.servicio.descargar(b, `despachos.${formato}`), error: (e) => this.aviso.error(e, 'No se pudo exportar el listado') });
    }
}
