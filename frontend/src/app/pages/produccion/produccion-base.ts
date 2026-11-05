import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subject, catchError, debounceTime, forkJoin, of, switchMap, tap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { TablaEsqueletoComponent } from '../../shared/components/tabla-esqueleto';
import { AyudaCampoComponent } from '../../shared/components/ayuda-campo';
import { KpiGridComponent, KpiItem } from '../../shared/components/kpi-grid';
import { AvisoService } from '../../shared/services/aviso.service';
import { ConsultaProduccion, FilaProduccion, ProduccionBaseService, ResumenProduccion } from './produccion-base.service';

const VISTAS = {
    resumen: { titulo: 'Producción de arroz', descripcion: 'Control de operaciones desde la recepción hasta el envasado.', tipo: '', singular: 'operación', plural: 'operaciones' },
    descarguios: { titulo: 'Descarguíos', descripcion: 'Recepción de arroz en chala, boletas y propietarios.', tipo: 'DESCARGUIO', singular: 'descarguío', plural: 'descarguíos' },
    secados: { titulo: 'Secados', descripcion: 'Seguimiento de secadoras, humedad y lotes en proceso.', tipo: 'SECADO', singular: 'secado', plural: 'secados' },
    guardados: { titulo: 'Guardados', descripcion: 'Almacenamiento del arroz y consulta de sus ubicaciones.', tipo: 'GUARDADO', singular: 'guardado', plural: 'guardados' },
    procesados: { titulo: 'Procesados', descripcion: 'Consumo de arroz en chala y productos obtenidos del pilado.', tipo: 'PROCESADO', singular: 'procesado', plural: 'procesados' },
    envasados: { titulo: 'Envasados', descripcion: 'Producto a granel y presentaciones envasadas.', tipo: 'ENVASADO', singular: 'envasado', plural: 'envasados' },
    lotes: { titulo: 'Lotes y trazabilidad', descripcion: 'Consulta de lotes, propietarios y existencias vinculadas.', tipo: '', singular: 'lote', plural: 'lotes' }
} as const;
type Vista = keyof typeof VISTAS;

@Component({
    selector: 'app-produccion-base', standalone: true,
    imports: [CommonModule, FormsModule, RouterModule, ButtonModule, DatePickerModule, SelectModule, InputTextModule,
        TableModule, TagModule, SkeletonModule, TablaEsqueletoComponent, AyudaCampoComponent, KpiGridComponent],
    template: `
        <div class="flex flex-wrap items-end justify-between gap-3 mb-5">
            <div>
                <div class="text-muted-color text-sm mb-2">Operaciones / Producción / {{ vista === 'resumen' ? 'Resumen' : configuracion.titulo }}</div>
                <h1 class="font-semibold text-2xl m-0 mb-1">{{ configuracion.titulo }}</h1>
                <p class="text-muted-color m-0">{{ configuracion.descripcion }}</p>
            </div>
            <p-button *ngIf="vista === 'resumen'" label="Ver lotes" icon="pi pi-sitemap" [outlined]="true" routerLink="/produccion/lotes" />
            <p-button *ngIf="vista !== 'resumen'" label="Resumen" icon="pi pi-chart-bar" [outlined]="true" routerLink="/produccion/resumen" />
        </div>

        <div class="card !mb-4">
            <form class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 items-end" (ngSubmit)="consultar()">
                <div class="min-w-0">
                    <label for="produccion-periodo" class="block font-semibold text-sm mb-2">Período</label>
                    <p-datepicker inputId="produccion-periodo" [(ngModel)]="rango" name="periodo" selectionMode="range" dateFormat="dd/mm/yy"
                        [showIcon]="true" iconDisplay="input" [showClear]="true" [readonlyInput]="true" placeholder="Todas las fechas" appendTo="body" fluid />
                </div>
                <div class="min-w-0">
                    <label for="produccion-modalidad" class="block font-semibold text-sm mb-2">Modalidad</label>
                    <p-select inputId="produccion-modalidad" [options]="modalidades" optionLabel="label" optionValue="value"
                        [(ngModel)]="modalidad" name="modalidad" appendTo="body" fluid />
                </div>
                <div class="min-w-0">
                    <label for="produccion-productor" class="block font-semibold text-sm mb-2">Productor</label>
                    <p-select inputId="produccion-productor" [options]="productores" optionLabel="nombre" optionValue="id" [(ngModel)]="productor"
                        name="productor" placeholder="Todos" [showClear]="true" [filter]="true" filterBy="nombre" appendTo="body" fluid />
                </div>
                <div><p-button label="Consultar" icon="pi pi-search" type="submit" [loading]="cargando" /></div>
            </form>
            <p *ngIf="errorFiltro" role="alert" class="text-red-600 text-sm mt-3 mb-0">{{ errorFiltro }}</p>
        </div>

        <ng-container *ngIf="vista === 'resumen'">
            <app-kpi-grid [items]="indicadores" [loading]="cargando" [compact]="true" *ngIf="cargando || resumen" />
            <div class="card !mb-4 !py-4" *ngIf="resumen && !cargando">
                <div class="flex items-center gap-2 font-semibold mb-3">Arroz en chala disponible
                    <app-ayuda-campo texto="Existencia actual de los lotes originados en el período seleccionado. Se agrupa por modalidad y unidad de medida." />
                </div>
                <div class="flex flex-wrap gap-3" *ngIf="resumen.chala.length; else sinChala">
                    <div class="rounded-border border border-surface-200 dark:border-surface-700 px-4 py-2" *ngFor="let saldo of resumen.chala">
                        <div class="text-muted-color text-xs mb-1">{{ saldo.modalidad === 'COMPRA' ? 'Propio del ingenio' : 'De terceros' }}</div>
                        <div class="font-semibold">{{ numero(saldo.cantidad) }} {{ saldo.unidad }}</div>
                    </div>
                </div>
                <ng-template #sinChala><p class="text-muted-color text-sm m-0">No hay existencias de chala para estos filtros.</p></ng-template>
                <p class="text-muted-color text-sm mt-3 mb-0">{{ resumen.indicadores.pendientes }} operaciones pendientes de completar.</p>
            </div>
            <div class="card !mb-4 !py-4">
                <div class="font-semibold mb-3">Flujo de producción</div>
                <div class="flex flex-wrap items-center gap-2">
                    <ng-container *ngFor="let etapa of etapas; let ultimo = last">
                        <p-button [label]="etapa.label" [icon]="etapa.icon" [outlined]="true" [routerLink]="'/produccion/' + etapa.ruta" size="small" />
                        <i class="pi pi-angle-right text-muted-color" *ngIf="!ultimo" aria-hidden="true"></i>
                    </ng-container>
                </div>
            </div>
        </ng-container>

        <div *ngIf="errorCarga" class="card !mb-4 flex flex-wrap gap-3 items-center justify-between" role="alert">
            <span class="text-red-600">{{ errorCarga }}</span>
            <p-button label="Reintentar" icon="pi pi-refresh" [outlined]="true" (onClick)="solicitar()" />
        </div>

        <div class="card !p-0 overflow-hidden">
            <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-surface-200 dark:border-surface-700">
                <h2 class="text-lg font-semibold m-0">{{ vista === 'resumen' ? 'Operaciones recientes' : 'Listado de ' + configuracion.plural }}</h2>
                <span class="relative w-full sm:w-72">
                    <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-muted-color" aria-hidden="true"></i>
                    <input pInputText class="w-full !pl-9" aria-label="Buscar registros de producción" placeholder="Código, boleta o productor..."
                        [(ngModel)]="buscar" (ngModelChange)="cambioBusqueda()" maxlength="150" />
                </span>
            </div>
            <p-table [value]="items" [lazy]="true" [lazyLoadOnInit]="false" (onLazyLoad)="paginar($event)" [loading]="cargando" [showLoader]="false"
                [paginator]="true" [alwaysShowPaginator]="true" [first]="primero" [rows]="filas" [rowsPerPageOptions]="[10, 20, 50]"
                [totalRecords]="total" [showCurrentPageReport]="true" [currentPageReportTemplate]="reportePagina"
                [sortField]="orden" [sortOrder]="direccion" [rowHover]="true" [tableStyle]="{ 'min-width': esLotes ? '70rem' : '58rem' }" responsiveLayout="scroll">
                <ng-template #header>
                    <tr *ngIf="!esLotes">
                        <th pSortableColumn="codigo">Documento <p-sortIcon field="codigo" /></th>
                        <th pSortableColumn="fecha">Fecha <p-sortIcon field="fecha" /></th>
                        <th pSortableColumn="productor">Productor <p-sortIcon field="productor" /></th>
                        <th>Propietario</th>
                        <th pSortableColumn="modalidad">Modalidad <p-sortIcon field="modalidad" /></th>
                        <th>Cantidad</th>
                        <th pSortableColumn="estado">Estado <p-sortIcon field="estado" /></th>
                    </tr>
                    <tr *ngIf="esLotes">
                        <th pSortableColumn="codigo">Lote <p-sortIcon field="codigo" /></th>
                        <th>Producto / variedad</th><th>Propietario</th>
                        <th pSortableColumn="modalidad">Modalidad <p-sortIcon field="modalidad" /></th>
                        <th class="text-right">Inicial</th>
                        <th pSortableColumn="cantidad_disponible" class="text-right">Disponible <p-sortIcon field="cantidad_disponible" /></th>
                        <th pSortableColumn="unidad">Unidad <p-sortIcon field="unidad" /></th>
                        <th pSortableColumn="etapa">Etapa <p-sortIcon field="etapa" /></th><th>Ubicación</th>
                    </tr>
                </ng-template>
                <ng-template #body let-item>
                    <tr *ngIf="!esLotes">
                        <td><span class="font-semibold">{{ item.codigo }}</span><div *ngIf="vista === 'resumen'" class="text-muted-color text-xs">{{ etiqueta(item.tipo) }}</div></td>
                        <td class="whitespace-nowrap">{{ item.fecha | date:'dd/MM/yyyy' }}</td>
                        <td>{{ item.productor || 'No informado' }}</td><td>{{ item.propietario || 'No informado' }}</td>
                        <td><p-tag [value]="item.modalidad === 'COMPRA' ? 'Compra' : 'Servicio'" [severity]="item.modalidad === 'COMPRA' ? 'info' : 'secondary'" /></td>
                        <td><div *ngFor="let cantidad of item.cantidades">{{ numero(cantidad.cantidad) }} {{ cantidad.unidad }}</div><span *ngIf="!item.cantidades?.length">—</span></td>
                        <td><p-tag [value]="etiqueta(item.estado)" [severity]="severidad(item.estado)" /></td>
                    </tr>
                    <tr *ngIf="esLotes">
                        <td class="font-semibold">{{ item.codigo }}</td><td>{{ item.producto }}<div class="text-muted-color text-xs">{{ item.variedad || 'Variedad no informada' }}</div></td>
                        <td>{{ item.propietario || 'No informado' }}</td><td><p-tag [value]="item.modalidad === 'COMPRA' ? 'Propio' : 'Servicio'" [severity]="item.modalidad === 'COMPRA' ? 'info' : 'secondary'" /></td>
                        <td class="text-right">{{ numero(item.cantidad_inicial) }}</td><td class="text-right font-semibold">{{ numero(item.cantidad_disponible) }}</td><td>{{ item.unidad }}</td>
                        <td>{{ etiqueta(item.etapa) }}</td><td>{{ item.ubicacion || 'No informada' }}<div class="text-muted-color text-xs">{{ item.ubicacion_detalle }}</div></td>
                    </tr>
                </ng-template>
                <ng-template #loadingbody><tr *ngFor="let f of [0,1,2,3,4]" app-tabla-esqueleto [columnas]="esLotes ? 9 : 7" [fila]="f"></tr></ng-template>
                <ng-template #emptymessage><tr><td [attr.colspan]="esLotes ? 9 : 7" class="!py-10 text-center text-muted-color">
                    {{ errorCarga ? 'La consulta no está disponible. Reintente para cargar los registros.' : 'No se encontraron ' + configuracion.plural + ' para los filtros seleccionados.' }}
                </td></tr></ng-template>
            </p-table>
        </div>
    `,
    styles: [`:host { display: block; min-width: 0; } :host ::ng-deep .p-datatable-tbody > tr > td { overflow-wrap: anywhere; }`]
})
export class ProduccionBasePage implements OnInit {
    private destroyRef = inject(DestroyRef);
    private recargar = new Subject<void>();
    private busqueda = new Subject<void>();
    private consultaAplicada: ConsultaProduccion = {};
    vista: Vista = 'resumen';
    configuracion: typeof VISTAS[Vista] = VISTAS.resumen;
    rango: Date[] | null = [new Date(new Date().getFullYear(), new Date().getMonth(), 1), new Date()];
    modalidad = ''; productor: number | null = null; buscar = '';
    primero = 0; filas = 10; orden = 'fecha'; direccion = -1;
    items: FilaProduccion[] = []; total = 0; resumen: ResumenProduccion | null = null;
    cargando = false; errorCarga = ''; errorFiltro = '';
    productores: { id: number; nombre: string }[] = [];
    modalidades = [{ label: 'Todas', value: '' }, { label: 'Compra (propio)', value: 'COMPRA' }, { label: 'Servicio a terceros', value: 'SERVICIO' }];
    etapas = [
        { label: 'Descarguío', ruta: 'descarguios', icon: 'pi pi-download' }, { label: 'Secado', ruta: 'secados', icon: 'pi pi-sun' },
        { label: 'Guardado', ruta: 'guardados', icon: 'pi pi-warehouse' }, { label: 'Procesado', ruta: 'procesados', icon: 'pi pi-cog' },
        { label: 'Envasado', ruta: 'envasados', icon: 'pi pi-box' }
    ];
    constructor(private api: ProduccionBaseService, private route: ActivatedRoute, private aviso: AvisoService) {}
    get esLotes(): boolean { return this.vista === 'lotes'; }
    get reportePagina(): string { return `Mostrando {first} a {last} de {totalRecords} ${this.configuracion.plural}`; }
    get indicadores(): KpiItem[] {
        const i = this.resumen?.indicadores;
        return [
            { label: 'Descarguíos por secar', value: String(i?.descarguios_por_secar ?? 0), icon: 'pi pi-download', tone: 'warn' },
            { label: 'Secados por guardar', value: String(i?.secados_por_guardar ?? 0), icon: 'pi pi-sun', tone: 'info' },
            { label: 'Lotes almacenados', value: String(i?.lotes_almacenados ?? 0), icon: 'pi pi-warehouse', tone: 'success' },
            { label: 'Procesados del período', value: String(i?.procesados ?? 0), icon: 'pi pi-cog', tone: 'neutral' }
        ];
    }
    ngOnInit(): void {
        this.recargar.pipe(
            tap(() => { this.cargando = true; this.errorCarga = ''; }),
            switchMap(() => forkJoin({
                listado: this.api.listado({ ...this.consultaAplicada, tipo: this.configuracion.tipo || undefined, buscar: this.buscar,
                    offset: this.primero, limit: this.filas, orden: this.orden, direccion: this.direccion }, this.esLotes),
                resumen: this.vista === 'resumen' ? this.api.resumen(this.consultaAplicada) : of(null)
            }).pipe(catchError(error => {
                this.errorCarga = this.aviso.error(error, 'No se pudo consultar Producción').mensaje;
                return of(null);
            }))), takeUntilDestroyed(this.destroyRef)
        ).subscribe(resultado => {
            this.cargando = false; this.items = resultado?.listado.items || []; this.total = resultado?.listado.total || 0;
            this.resumen = resultado?.resumen || null;
        });
        this.busqueda.pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef)).subscribe(() => { this.primero = 0; this.solicitar(); });
        this.api.catalogos().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: datos => this.productores = datos.productores,
            error: error => this.aviso.error(error, 'No se pudieron cargar los filtros de Producción')
        });
        this.route.data.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(datos => {
            const vista = String(datos['vista']); this.vista = vista in VISTAS ? vista as Vista : 'resumen';
            this.configuracion = VISTAS[this.vista]; this.buscar = ''; this.orden = 'fecha'; this.direccion = -1; this.consultar();
        });
    }
    consultar(): void {
        this.errorFiltro = '';
        if (this.rango?.[0] && this.rango?.[1] && this.rango[0] > this.rango[1]) { this.errorFiltro = 'La fecha inicial no puede ser posterior a la final.'; return; }
        this.consultaAplicada = { fecha_desde: this.fecha(this.rango?.[0]), fecha_hasta: this.fecha(this.rango?.[1] || this.rango?.[0]), modalidad: this.modalidad || undefined, id_productor: this.productor || undefined };
        this.primero = 0; this.solicitar();
    }
    solicitar(): void { this.recargar.next(); }
    cambioBusqueda(): void { this.busqueda.next(); }
    paginar(evento: TableLazyLoadEvent): void {
        const orden = typeof evento.sortField === 'string' ? evento.sortField : 'fecha';
        const direccion = evento.sortOrder === 1 ? 1 : -1;
        const cambioOrden = orden !== this.orden || direccion !== this.direccion;
        this.primero = cambioOrden ? 0 : (evento.first || 0); this.filas = evento.rows || 10; this.orden = orden; this.direccion = direccion; this.solicitar();
    }
    numero(valor: unknown): string { return valor == null ? '—' : new Intl.NumberFormat('es-BO', { maximumFractionDigits: 3 }).format(Number(valor)); }
    etiqueta(valor: string): string {
        return ({ DESCARGUIO: 'Descarguío', SECADO: 'Secado', GUARDADO: 'Guardado', PROCESADO: 'Procesado', ENVASADO: 'Envasado',
            BORRADOR: 'Borrador', EN_CURSO: 'En curso', CONFIRMADO: 'Confirmado', ANULADO: 'Anulado' } as Record<string, string>)[valor] || valor;
    }
    severidad(estado: string): 'success' | 'warn' | 'secondary' | 'info' {
        return estado === 'CONFIRMADO' ? 'success' : estado === 'BORRADOR' ? 'warn' : estado === 'EN_CURSO' ? 'info' : 'secondary';
    }
    private fecha(valor: Date | undefined | null): string | undefined {
        return valor ? `${valor.getFullYear()}-${String(valor.getMonth() + 1).padStart(2, '0')}-${String(valor.getDate()).padStart(2, '0')}` : undefined;
    }
}
