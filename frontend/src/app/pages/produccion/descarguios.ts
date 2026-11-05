import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject, catchError, debounceTime, of, switchMap, tap } from 'rxjs';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TablaEsqueletoComponent } from '../../shared/components/tabla-esqueleto';
import { BotonesExportarComponent } from '../../shared/components/botones-exportar';
import { AvisoService } from '../../shared/services/aviso.service';
import { ExportarService } from '../../shared/services/exportar.service';
import { DescarguiosService, FiltroDescarguios, ListadoDescarguios, OpcionDescarguio } from './descarguios.service';
import { permisoDescarguio } from './produccion-permisos';

@Component({
    selector: 'app-descarguios', standalone: true,
    imports: [CommonModule, FormsModule, RouterModule, AutoCompleteModule, ButtonModule, DatePickerModule, SelectModule, InputTextModule, TableModule, TagModule, TablaEsqueletoComponent, BotonesExportarComponent],
    template: `
        <div class="flex flex-wrap items-end justify-between gap-3 mb-5">
            <div><div class="text-muted-color text-sm mb-2">Operaciones / Producción / Descarguíos</div>
                <h1 class="text-2xl font-semibold m-0 mb-1">Control de descarguíos</h1><p class="text-muted-color m-0">Recepción de arroz en chala y seguimiento por propietario.</p></div>
            <div class="flex flex-wrap gap-2"><p-button label="Resumen" icon="pi pi-chart-bar" [outlined]="true" routerLink="/produccion/resumen" />
                <p-button *ngIf="puedeCrear" label="Nuevo descarguío" icon="pi pi-plus" routerLink="/produccion/descarguios/nuevo" /></div>
        </div>
        <div class="card !mb-4"><form class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 items-end" (ngSubmit)="consultar()">
            <div><label for="desc-desde" class="block font-semibold text-sm mb-2">Desde</label><p-datepicker inputId="desc-desde" name="desde" [(ngModel)]="desde" dateFormat="dd/mm/yy" [showIcon]="true" [showClear]="true" appendTo="body" fluid /></div>
            <div><label for="desc-hasta" class="block font-semibold text-sm mb-2">Hasta</label><p-datepicker inputId="desc-hasta" name="hasta" [(ngModel)]="hasta" dateFormat="dd/mm/yy" [showIcon]="true" [showClear]="true" appendTo="body" fluid /></div>
            <div><label for="desc-productor" class="block font-semibold text-sm mb-2">Productor</label><p-autocomplete inputId="desc-productor" name="productor" [(ngModel)]="productor" [suggestions]="productores" optionLabel="nombre" [forceSelection]="true" [dropdown]="true" [showClear]="true" (completeMethod)="opciones('productores',$event.query)" appendTo="body" fluid /></div>
            <div><label for="desc-modalidad" class="block font-semibold text-sm mb-2">Modalidad</label><p-select inputId="desc-modalidad" name="modalidad" [(ngModel)]="modalidad" [options]="modalidades" optionLabel="label" optionValue="value" appendTo="body" fluid /></div>
            <div><label for="desc-variedad" class="block font-semibold text-sm mb-2">Variedad</label><input pInputText id="desc-variedad" name="variedad" class="w-full" [(ngModel)]="variedad" placeholder="Todas" maxlength="100" /></div>
            <div><label for="desc-estado" class="block font-semibold text-sm mb-2">Estado</label><p-select inputId="desc-estado" name="estado" [(ngModel)]="estado" [options]="estados" optionLabel="label" optionValue="value" appendTo="body" fluid /></div>
            <div class="flex gap-2 sm:col-span-2 lg:col-span-3 xl:col-span-6"><p-button label="Consultar" type="submit" icon="pi pi-search" [loading]="cargando" /></div>
        </form><p class="text-red-600 text-sm mb-0" *ngIf="errorFiltro" role="alert">{{ errorFiltro }}</p></div>
        <div class="card !py-3 !mb-4" *ngIf="resultado && !errorCarga">
            <div class="flex flex-wrap gap-x-6 gap-y-2 text-sm"><span><strong>{{ resultado.resumen.confirmados }}</strong> confirmados</span><span><strong>{{ resultado.resumen.borradores }}</strong> borradores</span><span><strong>{{ resultado.resumen.anulados }}</strong> anulados</span></div>
            <div class="flex flex-wrap gap-x-6 gap-y-2 text-sm mt-2" *ngIf="totalesConfirmados.length"><span *ngFor="let total of totalesConfirmados">{{ total.modalidad === 'COMPRA' ? 'Compra' : 'Servicio' }}: <strong>{{ numero(total.cantidad) }} {{ total.unidad }}</strong></span></div>
        </div>
        <div class="card !p-0 overflow-hidden">
            <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <span class="relative w-full sm:w-80"><i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-muted-color"></i><input pInputText class="w-full !pl-9" aria-label="Buscar descarguío" placeholder="Boleta, productor o código D..." [(ngModel)]="buscar" (ngModelChange)="buscarCambios.next()" maxlength="150" /></span>
                <div class="flex gap-2"><app-botones-exportar tipo="descarguios" [fechaDesde]="aplicado.fecha_desde" [fechaHasta]="aplicado.fecha_hasta" [idProductor]="aplicado.id_productor" [modalidad]="aplicado.modalidad" [variedad]="aplicado.variedad" [estado]="aplicado.estado" [q]="buscar" [orden]="orden" [direccion]="direccion" [disabled]="cargando || !!errorCarga" />
                    <p-button label="Imprimir" icon="pi pi-print" [outlined]="true" (onClick)="imprimir()" [disabled]="cargando || !!errorCarga" /></div>
            </div>
            <div *ngIf="errorCarga" role="alert" class="px-5 pb-4 text-red-600 flex gap-3 items-center">{{ errorCarga }}<p-button label="Reintentar" [text]="true" (onClick)="recargar.next()" /></div>
            <p-table [value]="resultado?.items || []" [lazy]="true" [lazyLoadOnInit]="false" (onLazyLoad)="paginar($event)" [loading]="cargando" [showLoader]="false" [paginator]="true" [alwaysShowPaginator]="true"
                [first]="primero" [rows]="filas" [rowsPerPageOptions]="[10,20,50]" [totalRecords]="resultado?.total || 0" [showCurrentPageReport]="true" currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} descarguíos"
                [sortField]="orden" [sortOrder]="direccion" [rowHover]="true" [tableStyle]="{ 'min-width': '85rem' }" responsiveLayout="scroll">
                <ng-template #header><tr><th pSortableColumn="codigo">Código D <p-sortIcon field="codigo" /></th><th pSortableColumn="fecha">Fecha <p-sortIcon field="fecha" /></th><th pSortableColumn="boleta">Boleta <p-sortIcon field="boleta" /></th>
                    <th pSortableColumn="productor">Productor <p-sortIcon field="productor" /></th><th pSortableColumn="modalidad">Modalidad <p-sortIcon field="modalidad" /></th><th pSortableColumn="variedad">Variedad <p-sortIcon field="variedad" /></th>
                    <th pSortableColumn="cantidad">Cantidad <p-sortIcon field="cantidad" /></th><th>Unidad</th><th pSortableColumn="humedad_entrada">Humedad <p-sortIcon field="humedad_entrada" /></th><th>Ubicación</th><th pSortableColumn="estado">Estado <p-sortIcon field="estado" /></th><th>Acciones</th></tr></ng-template>
                <ng-template #body let-fila><tr><td class="font-semibold">{{ fila.codigo }}</td><td class="whitespace-nowrap">{{ fila.fecha | date:'dd/MM/yyyy' }}</td><td>{{ fila.boleta || 'No informada' }}</td><td>{{ fila.productor || 'No informado' }}</td>
                    <td><p-tag [value]="fila.modalidad === 'COMPRA' ? 'Compra' : 'Servicio'" [severity]="fila.modalidad === 'COMPRA' ? 'info' : 'secondary'" /></td><td>{{ fila.variedad || 'No informada' }}</td><td class="text-right">{{ numero(fila.cantidad) }}</td><td>{{ fila.unidad || '—' }}</td><td>{{ fila.humedad_entrada == null ? 'No medida' : numero(fila.humedad_entrada) + ' %' }}</td><td>{{ fila.ubicacion || 'No informada' }}</td>
                    <td><p-tag [value]="etiqueta(fila.estado)" [severity]="fila.estado === 'CONFIRMADO' ? 'success' : fila.estado === 'BORRADOR' ? 'warn' : 'secondary'" /></td>
                    <td><p-button [label]="fila.estado === 'BORRADOR' && puedeEditar ? 'Editar' : 'Ver detalle'" [icon]="fila.estado === 'BORRADOR' && puedeEditar ? 'pi pi-pencil' : 'pi pi-eye'" [text]="true" [routerLink]="['/produccion/descarguios',fila.id]" size="small" /></td></tr></ng-template>
                <ng-template #loadingbody><tr *ngFor="let f of [0,1,2,3,4]" app-tabla-esqueleto [columnas]="12" [fila]="f"></tr></ng-template>
                <ng-template #emptymessage><tr><td colspan="12" class="!py-10 text-center text-muted-color">{{ errorCarga ? 'No se pudo cargar la consulta.' : 'No hay descarguíos para los filtros seleccionados.' }}</td></tr></ng-template>
            </p-table>
        </div>
    `,
    styles: [`:host{display:block;min-width:0}:host ::ng-deep .p-datatable-tbody>tr>td{overflow-wrap:anywhere}`]
})
export class DescarguiosPage implements OnInit {
    private destroyRef = inject(DestroyRef);
    recargar = new Subject<void>(); buscarCambios = new Subject<void>();
    desde: Date | null = new Date(new Date().getFullYear(), new Date().getMonth(), 1); hasta: Date | null = new Date();
    productor: OpcionDescarguio | null = null; productores: OpcionDescarguio[] = [];
    modalidad = ''; variedad = ''; estado = ''; buscar = ''; aplicado: FiltroDescarguios = {};
    primero = 0; filas = 10; orden = 'fecha'; direccion = -1; cargando = false; errorCarga = ''; errorFiltro = '';
    resultado: ListadoDescarguios | null = null;
    puedeCrear = permisoDescarguio('escritura'); puedeEditar = permisoDescarguio('modificacion');
    modalidades = [{ label: 'Todas', value: '' }, { label: 'Compra', value: 'COMPRA' }, { label: 'Servicio a terceros', value: 'SERVICIO' }];
    estados = [{ label: 'Todos', value: '' }, { label: 'Borrador', value: 'BORRADOR' }, { label: 'Confirmado', value: 'CONFIRMADO' }, { label: 'Anulado', value: 'ANULADO' }];
    constructor(private api: DescarguiosService, private aviso: AvisoService, private exportador: ExportarService) {}
    get totalesConfirmados() { return this.resultado?.resumen.cantidades.filter(c => c.estado === 'CONFIRMADO') || []; }
    ngOnInit() {
        this.recargar.pipe(tap(() => { this.cargando = true; this.errorCarga = ''; }), switchMap(() => this.api.listar({ ...this.aplicado, buscar: this.buscar, offset: this.primero, limit: this.filas, orden: this.orden, direccion: this.direccion }).pipe(
            catchError(error => { this.errorCarga = this.aviso.error(error, 'No se pudo consultar descarguíos').mensaje; return of(null); })
        )), takeUntilDestroyed(this.destroyRef)).subscribe(datos => { this.resultado = datos; this.cargando = false; });
        this.buscarCambios.pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef)).subscribe(() => { this.primero = 0; this.recargar.next(); });
        this.consultar();
    }
    consultar() {
        this.errorFiltro = '';
        if ((this.desde && !Number.isFinite(this.desde.getTime())) || (this.hasta && !Number.isFinite(this.hasta.getTime())) || (this.desde && this.hasta && this.desde > this.hasta)) { this.errorFiltro = 'Revise el intervalo de fechas.'; return; }
        this.aplicado = { fecha_desde: this.ymd(this.desde), fecha_hasta: this.ymd(this.hasta), modalidad: this.modalidad || undefined, variedad: this.variedad.trim() || undefined, estado: this.estado || undefined, id_productor: this.productor?.id };
        this.primero = 0; this.recargar.next();
    }
    paginar(e: TableLazyLoadEvent) {
        const orden = typeof e.sortField === 'string' ? e.sortField : 'fecha', direccion = e.sortOrder === 1 ? 1 : -1;
        this.primero = orden !== this.orden || direccion !== this.direccion ? 0 : (e.first || 0); this.orden = orden; this.direccion = direccion; this.filas = e.rows || 10; this.recargar.next();
    }
    opciones(grupo: string, query: string) { this.api.opciones(grupo, query).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: opciones => this.productores = opciones, error: e => this.aviso.error(e, 'No se pudo consultar productores') }); }
    imprimir() {
        const ventana = this.exportador.abrirVentanaEspera();
        this.exportador.mostrarPdf({ tipo: 'descarguios', formato: 'pdf', ...this.aplicado, q: this.buscar, orden: this.orden, direccion: this.direccion }, ventana).subscribe({ error: e => this.aviso.error(e, 'No se pudo generar el PDF') });
    }
    numero(valor: unknown) { return valor == null ? '—' : new Intl.NumberFormat('es-BO', { maximumFractionDigits: 3 }).format(Number(valor)); }
    etiqueta(estado: string) { return ({ BORRADOR: 'Borrador', CONFIRMADO: 'Confirmado', ANULADO: 'Anulado' } as Record<string, string>)[estado] || estado; }
    private ymd(d: Date | null) { return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` : undefined; }
}
