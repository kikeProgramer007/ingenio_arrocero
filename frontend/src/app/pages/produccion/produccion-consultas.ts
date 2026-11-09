import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, DestroyRef, Input, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, of, switchMap, tap } from 'rxjs';
import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { Menu, MenuModule } from 'primeng/menu';
import { MultiSelectModule } from 'primeng/multiselect';
import { apiUrl } from '../../core/utils/api-url';
import { AvisoService } from '../../shared/services/aviso.service';
import { ExportarService, ParamsExport } from '../../shared/services/exportar.service';
import { permisoEtapa } from './produccion-permisos';

type Datos = Record<string, any>;
type Columna = { label: string; field: string };

@Component({
    selector: 'app-produccion-consultas',
    standalone: true,
    imports: [
        CommonModule, FormsModule, RouterModule, ButtonModule, TableModule, SelectModule, DatePickerModule,
        InputTextModule, SkeletonModule, TagModule, MenuModule, MultiSelectModule
    ],
    templateUrl: './produccion-consultas.html',
    styles: [`
        :host { display: block; min-width: 0; }
        th, td { overflow-wrap: anywhere; white-space: normal; }
        .detalle-evento { border-left: 2px solid var(--surface-border); padding: 0 0 1.25rem 1.25rem; margin-left: .5rem; }
        .reporte-exp {
            background: var(--surface-ground);
            border: 1px solid var(--surface-border);
            border-radius: 0.75rem;
            padding: 1rem 1.25rem;
            margin: 0.15rem 0.35rem 0.65rem;
        }
        .reporte-exp__cabecera {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: space-between;
            gap: 0.75rem;
            margin-bottom: 0.85rem;
        }
        .reporte-exp__titulo { margin: 0; font-size: 0.95rem; font-weight: 600; }
        .reporte-exp__grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 0.35rem 1.75rem;
        }
        @media (min-width: 768px) {
            .reporte-exp__grid { grid-template-columns: 1fr 1fr; }
        }
        .reporte-exp dl { margin: 0; }
        .reporte-exp dt {
            margin: 0;
            font-size: 0.72rem;
            letter-spacing: 0.01em;
            color: var(--text-color-secondary);
        }
        .reporte-exp dd {
            margin: 0 0 0.65rem;
            font-weight: 500;
            color: var(--text-color);
        }
        .reporte-fila-expandida > td { background: color-mix(in srgb, var(--primary-color) 4%, transparent); }
        :host ::ng-deep .p-datatable-row-expansion > td { padding: 0 !important; border: 0 !important; }
    `]
})
export class ProduccionConsultasPage implements OnInit {
    @Input() reportes = false;
    private http = inject(HttpClient);
    private aviso = inject(AvisoService);
    private exportar = inject(ExportarService);
    private destroy = inject(DestroyRef);
    private route = inject(ActivatedRoute);

    /** Columnas preferidas en la fila principal (el resto va al panel expandible). */
    private readonly prioridadPrincipales = [
        'Código', 'Lote', 'Proceso', 'Secado', 'Guardado', 'Procesado', 'Envasado',
        'Fecha', 'Boleta', 'N° boleta', 'Productor', 'Productor/Proveedor', 'Variedad', 'Cantidad',
        'Entrada medida (kg)', 'Inicial', 'Disponible', 'Ubicación', 'Silo',
        'Rendimiento (%)', 'Estado'
    ];

    readonly reportesDisponibles = [
        { value: 'descarguios', label: 'Control de descarguíos', permiso: 'descarguios' },
        { value: 'secados', label: 'Control de secados', permiso: 'secados' },
        { value: 'guardados', label: 'Control de guardados', permiso: 'guardados' },
        { value: 'procesados', label: 'Control de procesados', permiso: 'procesados' },
        { value: 'envasados', label: 'Control de envasados', permiso: 'envasados' },
        { value: 'existencias', label: 'Existencias por productor/proveedor', permiso: 'lotes' },
        { value: 'rendimiento', label: 'Rendimiento de producción', permiso: 'procesados' }
    ].filter(r => permisoEtapa(r.permiso, 'lectura'));

    tipo = '';
    desde: Date | null = null;
    hasta: Date | null = null;
    productor: number[] = [];
    modalidad: string[] = [];
    propiedad: string[] = [];
    variedad: string[] = [];
    estado: string[] = [];
    ubicacion: string[] = [];
    clasificacion: string[] = [];
    fisico: string[] = [];
    buscar = '';
    catalogos: Datos = {};
    resultado: Datos | null = null;
    detalle: Datos | null = null;
    cargandoFiltros = true;
    cargando = false;
    error = '';
    primero = 0;
    filas = 10;
    orden = 'fecha';
    direccion = -1;
    aplicado: Datos = {};
    recargar = new Subject<void>();
    busqueda = new Subject<void>();
    detalleId: number | null = null;

    expandedRows: Record<string, boolean> = {};
    columnasSeleccionadas: string[] = [];
    itemsAcciones: MenuItem[] = [];
    filaMenu: Datos | null = null;

    modalidades = [
        
        { label: 'Compra', value: 'COMPRA' },
        { label: 'Servicio', value: 'SERVICIO' }
    ];
    propiedades = [
        
        { label: 'Propio', value: 'PROPIO' },
        { label: 'Tercero', value: 'TERCERO' }
    ];

    get esExistencia() { return !this.reportes || this.tipo === 'existencias'; }
    get estados() { return this.esExistencia ? ['ACTIVO', 'AGOTADO', 'ANULADO'] : ['BORRADOR', 'CONFIRMADO', 'ANULADO']; }
    get titulo() {
        return this.reportes
            ? this.reportesDisponibles.find(r => r.value === this.tipo)?.label || 'Reportes de producción'
            : 'Lotes y trazabilidad';
    }
    get columnas(): Columna[] {
        return this.reportes
            ? (this.resultado?.['columnas'] || []).map((label: string, i: number) => ({ label: label === 'Productor' ? 'Productor/Proveedor' : label, field: String(i) }))
            : [
                { label: 'Lote', field: 'codigo' }, { label: 'Recepción', field: 'fecha' }, { label: 'Boleta', field: 'boleta' },
                { label: 'Productor/Proveedor', field: 'productor' }, { label: 'Propietario', field: 'propietario' }, { label: 'Modalidad', field: 'modalidad' },
                { label: 'Variedad', field: 'variedad' }, { label: 'Producto', field: 'producto' }, { label: 'Inicial', field: 'cantidad_inicial' },
                { label: 'Disponible', field: 'cantidad_disponible' }, { label: 'Unidad', field: 'unidad' }, { label: 'Ubicación', field: 'ubicacion' },
                { label: 'Estado', field: 'estado' }
            ];
    }
    get columnasPrincipales(): Columna[] {
        const sel = new Set(this.columnasSeleccionadas);
        return this.columnas.filter(c => sel.has(c.field));
    }
    get columnasDetalle(): Columna[] {
        const sel = new Set(this.columnasSeleccionadas);
        return this.columnas.filter(c => !sel.has(c.field));
    }
    get colspanReporte(): number {
        return this.columnasPrincipales.length + 2;
    }
    get resumenCards(): { label: string; valor: string }[] {
        return (this.resultado?.['resumen'] || []) as { label: string; valor: string }[];
    }

    ngOnInit() {
        this.tipo = this.reportesDisponibles[0]?.value || '';
        this.orden = this.reportes ? '0' : 'fecha';
        this.http.get<Datos>(apiUrl('/api/produccion/lotes/opciones')).pipe(takeUntilDestroyed(this.destroy)).subscribe({
            next: r => {this.catalogos = r;this.cargandoFiltros=false;},
            error: e => {this.cargandoFiltros=false;this.aviso.error(e, 'No se pudieron cargar filtros de producción');}
        });
        this.recargar.pipe(
            tap(() => { this.cargando = true; this.error = ''; }),
            switchMap(() => {
                const path = this.detalleId ? '/lotes/' + this.detalleId : this.reportes ? '/reportes/' + this.tipo : '/lotes';
                return this.http.get<Datos>(apiUrl('/api/produccion' + path), { params: this.params() }).pipe(
                    catchError(e => {
                        this.error = this.aviso.error(e, 'No se pudo cargar Producción').mensaje;
                        return of(null);
                    })
                );
            }),
            takeUntilDestroyed(this.destroy)
        ).subscribe(r => {
            if (this.detalleId) this.detalle = r;
            else {
                const prev = (this.resultado?.['columnas'] || []).join('|');
                this.resultado = r;
                if (this.reportes && r && (r['columnas'] || []).join('|') !== prev) {
                    this.aplicarColumnasPorDefecto();
                    this.expandedRows = {};
                }
            }
            this.cargando = false;
        });
        this.busqueda.pipe(debounceTime(350), takeUntilDestroyed(this.destroy)).subscribe(() => {
            this.primero = 0;
            this.recargar.next();
        });
        if (!this.reportes) {
            this.route.paramMap.pipe(takeUntilDestroyed(this.destroy)).subscribe(p => {
                this.detalleId = p.get('id') ? Number(p.get('id')) : null;
                this.detalle = null;
                this.recargar.next();
            });
        } else if (this.tipo) this.consultar();
    }

    fecha(d: Date | null) {
        return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : undefined;
    }
    params() {
        let p = new HttpParams();
        for (const [k, v] of Object.entries(this.query())) if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
        return p;
    }
    query() {
        return {
            ...this.aplicado,
            buscar: this.buscar.trim(),
            orden: this.reportes ? 'fecha' : this.orden,
            columna: this.reportes ? Number(this.orden) : undefined,
            direccion: this.direccion,
            limit: this.filas,
            offset: this.primero
        };
    }
    consultar() {
        if (this.desde && this.hasta && this.desde > this.hasta) {
            this.error = 'La fecha inicial no puede ser posterior a la final.';
            return;
        }
        this.aplicado = {
            fecha_desde: this.fecha(this.desde),
            fecha_hasta: this.fecha(this.hasta),
            id_productor: this.productor?.join(','),
            modalidad: this.modalidad?.join(','),
            variedad: this.variedad?.join(','),
            estado: this.estado?.join(','),
            ...(this.esExistencia
                ? { propiedad: this.propiedad?.join(','), ubicacion: this.ubicacion?.join(','), clasificacion: this.clasificacion?.join(','), estado_fisico: this.fisico?.join(',') }
                : {})
        };
        this.primero = 0;
        this.recargar.next();
    }
    cambiarReporte() {
        this.estado = [];
        this.orden = '0';
        this.resultado = null;
        this.columnasSeleccionadas = [];
        this.expandedRows = {};
        this.consultar();
    }
    paginar(e: TableLazyLoadEvent) {
        this.primero = e.first || 0;
        this.filas = e.rows || 10;
        this.orden = typeof e.sortField === 'string' ? e.sortField : this.reportes ? '0' : 'fecha';
        this.direccion = e.sortOrder === 1 ? 1 : -1;
        this.recargar.next();
    }
    numero(v: unknown) {
        return v == null ? 'No medido' : new Intl.NumberFormat('es-BO', { maximumFractionDigits: 3 }).format(Number(v));
    }
    celda(r: Datos, c: Columna) {
        const v = this.reportes ? r['valores'][Number(c.field)] : r[c.field];
        return typeof v === 'number' || (!this.reportes && ['cantidad_inicial', 'cantidad_disponible'].includes(c.field))
            ? this.numero(v)
            : v ?? '—';
    }
    esNumero(r: Datos, c: Columna) {
        return this.reportes
            ? typeof r['valores'][Number(c.field)] === 'number'
            : ['cantidad_inicial', 'cantidad_disponible'].includes(c.field);
    }
    archivo(formato: 'pdf' | 'xlsx') {
        const p: ParamsExport = {
            ...this.query(),
            tipo: this.reportes ? 'reporte_produccion' : 'lotes_produccion',
            reporte: this.tipo,
            formato
        };
        const visor = formato === 'pdf' ? this.exportar.abrirVentanaEspera() : null;
        (formato === 'pdf' ? this.exportar.mostrarPdf(p, visor) : this.exportar.descargar(p))
            .pipe(takeUntilDestroyed(this.destroy))
            .subscribe({ error: e => { visor?.close(); this.aviso.error(e, 'No se pudo exportar'); } });
    }

    aplicarColumnasPorDefecto() {
        const cols = this.columnas;
        if (!cols.length) { this.columnasSeleccionadas = []; return; }
        const max = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches ? 4 : 8;
        const porLabel = new Map(cols.map(c => [c.label, c.field]));
        const elegidas: string[] = [];
        for (const label of this.prioridadPrincipales) {
            const f = porLabel.get(label);
            if (f != null && !elegidas.includes(f)) elegidas.push(f);
            if (elegidas.length >= max) break;
        }
        const estado = cols.find(c => /^estado$/i.test(c.label));
        if (estado && !elegidas.includes(estado.field)) {
            if (elegidas.length >= max) elegidas[elegidas.length - 1] = estado.field;
            else elegidas.push(estado.field);
        }
        if (!elegidas.length) elegidas.push(...cols.slice(0, Math.min(max, cols.length)).map(c => c.field));
        this.columnasSeleccionadas = elegidas;
    }

    esColumnaEstado(c: Columna) {
        return /^estado$/i.test(c.label);
    }

    severidadEstado(valor: unknown): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
        const v = String(valor ?? '').toUpperCase();
        if (v.includes('CONFIRM') || v === 'ACTIVO' || v.includes('CERRAD')) return 'success';
        if (v.includes('BORRADOR') || v.includes('PEND') || v.includes('PROCES')) return 'warn';
        if (v.includes('ANUL') || v === 'AGOTADO') return 'secondary';
        return 'info';
    }

    etiquetaEstado(valor: unknown) {
        const v = String(valor ?? '');
        if (v === 'CONFIRMADO') return 'Confirmado';
        if (v === 'BORRADOR') return 'Borrador';
        if (v === 'ANULADO') return 'Anulado';
        if (v === 'ACTIVO') return 'Activo';
        if (v === 'AGOTADO') return 'Agotado';
        return v || '—';
    }

    abrirAcciones(event: Event, menu: Menu, fila: Datos, expanded: boolean) {
        this.filaMenu = fila;
        this.itemsAcciones = [
            {
                label: expanded ? 'Ocultar detalle' : 'Ver detalle',
                icon: expanded ? 'pi pi-chevron-up' : 'pi pi-eye',
                command: () => this.alternarFila(fila)
            }
        ];
        menu.toggle(event);
    }

    onExpandir(e: { data: Datos }) {
        this.expandedRows = { ...this.expandedRows, [String(e.data['id'])]: true };
    }
    onColapsar(e: { data: Datos }) {
        const next = { ...this.expandedRows };
        delete next[String(e.data['id'])];
        this.expandedRows = next;
    }
    alternarFila(fila: Datos) {
        const key = String(fila['id']);
        if (this.expandedRows[key]) this.onColapsar({ data: fila });
        else this.onExpandir({ data: fila });
    }

    mitadIzquierda(cols: Columna[]) {
        return cols.slice(0, Math.ceil(cols.length / 2));
    }
    mitadDerecha(cols: Columna[]) {
        return cols.slice(Math.ceil(cols.length / 2));
    }
}
