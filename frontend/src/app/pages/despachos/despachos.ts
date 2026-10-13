import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
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
    imports: [CommonModule, FormsModule, ButtonModule, SelectModule, TableModule, TagModule, DatePickerModule, InputTextModule, DespachoFormComponent, TablaEsqueletoComponent],
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
            <div><label class="block font-bold mb-2">Cliente</label><p-select [options]="clientes" optionLabel="nombre" optionValue="id" [(ngModel)]="cliente" [showClear]="true" [filter]="true" placeholder="Todos" fluid appendTo="body" /></div>
            <div><label class="block font-bold mb-2">Estado de despacho</label><p-select [options]="estados" optionLabel="label" optionValue="value" [(ngModel)]="estado" fluid appendTo="body" /></div>
            <div><label class="block font-bold mb-2">Fecha de venta</label><p-datepicker [(ngModel)]="rango" selectionMode="range" [showIcon]="true" dateFormat="dd/mm/yy" [showClear]="true" fluid appendTo="body" /></div>
            <div><label class="block font-bold mb-2">Número de venta</label><input pInputText type="number" min="1" class="w-full" [(ngModel)]="numero" (keyup.enter)="consultar()" /></div>
            <div class="flex items-end"><p-button label="Consultar" icon="pi pi-search" (onClick)="consultar()" /></div>
        </div>
        <p-table
            [value]="cargando ? [] : ventas"
            [loading]="cargando"
            [showLoader]="false"
            [lazy]="true"
            (onLazyLoad)="paginar($event)"
            [paginator]="true"
            [rows]="limite"
            [first]="primero"
            [totalRecords]="total"
            [rowsPerPageOptions]="[10, 25, 50]"
            [showCurrentPageReport]="true"
            currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} ventas"
            responsiveLayout="scroll"
        >
            <ng-template #header
                ><tr>
                    <th></th>
                    <th>Venta</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Estado de pago</th>
                    <th>Estado de despacho</th>
                    <th>Acciones</th>
                </tr></ng-template
            >
            <ng-template #body let-v>
                <tr>
                    <td><p-button [icon]="expandida === v.id ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" [text]="true" ariaLabel="Mostrar productos" (onClick)="expandida = expandida === v.id ? null : v.id" /></td>
                    <td>#{{ v.id }}</td>
                    <td>{{ v.fecha | date: 'dd/MM/yyyy' }}</td>
                    <td>{{ v.cliente?.nombre }}</td>
                    <td><p-tag [value]="v.estado === 'PARCIAL' ? 'Pago parcial' : v.estado" [severity]="v.estado === 'PAGADA' ? 'success' : 'warn'" /></td>
                    <td><p-tag [value]="etiqueta(v.estado_despacho)" [severity]="color(v.estado_despacho)" /></td>
                    <td>
                        <div class="flex gap-2">
                            <p-button *ngIf="habilitado && (v.estado_despacho === 'PENDIENTE' || v.estado_despacho === 'PARCIAL')" label="Registrar despacho" icon="pi pi-truck" (onClick)="form.abrir(v)" /><p-button
                                icon="pi pi-history"
                                [outlined]="true"
                                ariaLabel="Historial de despachos"
                                (onClick)="form.abrir(v, true)"
                            />
                        </div>
                    </td>
                </tr>
                <tr *ngIf="expandida === v.id">
                    <td colspan="7">
                        <p-table [value]="productos(v)"
                            ><ng-template #header
                                ><tr>
                                    <th>Producto</th>
                                    <th>Unidad</th>
                                    <th>Vendido</th>
                                    <th>Despachado</th>
                                    <th>Pendiente</th>
                                </tr></ng-template
                            ><ng-template #body let-l
                                ><tr>
                                    <td>{{ l.descripcion }}</td>
                                    <td>{{ l.unidad }}</td>
                                    <td>{{ l.cantidad }}</td>
                                    <td>{{ l.entregado }}</td>
                                    <td>{{ l.pendiente }}</td>
                                </tr></ng-template
                            ><ng-template #emptymessage
                                ><tr>
                                    <td colspan="5">Sin productos físicos.</td>
                                </tr></ng-template
                            ></p-table
                        >
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
        <app-despacho-form #form (confirmado)="cargar()" />`
})
export class DespachosComponent implements OnInit {
    clientes: Cliente[] = [];
    ventas: Venta[] = [];
    total = 0;
    cargando = false;
    habilitado = false;
    cliente: number | null = null;
    numero: number | null = null;
    rango: Date[] | null = null;
    estado = 'ABIERTOS';
    primero = 0;
    limite = 10;
    expandida: number | null = null;
    filtros: FiltroDespachos = { estado_despacho: 'ABIERTOS' };
    secuencia = 0;
    etiqueta = etiquetaDespacho;
    color = colorDespacho;
    estados = [
        { label: 'Pendientes y parciales', value: 'ABIERTOS' },
        { label: 'Todos', value: 'TODOS' },
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
            estado_despacho: this.estado,
            id_cliente: this.cliente || undefined,
            numero: this.numero || undefined,
            fecha_desde: this.rango?.[0] ? this.ymd(this.rango[0]) : undefined,
            fecha_hasta: this.rango?.[0] ? this.ymd(this.rango[1] || this.rango[0]) : undefined
        };
        this.primero = 0;
        this.cargar();
    }
    paginar(e: any) {
        this.primero = e.first || 0;
        this.limite = e.rows || 10;
        this.cargar();
    }
    cargar() {
        const id = ++this.secuencia;
        this.cargando = true;
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
    exportar(formato: 'pdf' | 'xlsx') {
        this.servicio.exportar(this.filtros, formato).subscribe({ next: (b) => this.servicio.descargar(b, `despachos.${formato}`), error: (e) => this.aviso.error(e, 'No se pudo exportar el listado') });
    }
}
