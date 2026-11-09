import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
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
import { KpiItem } from '../../shared/components/kpi-grid';
import { AvisoService } from '../../shared/services/aviso.service';
import { ConsultaProduccion, FilaProduccion, ProduccionBaseService, ResumenProduccion } from './produccion-base.service';
import { permisoEtapa } from './produccion-permisos';

@Component({
    selector: 'app-produccion-base',
    standalone: true,
    imports: [
        CommonModule, FormsModule, RouterModule, ButtonModule, DatePickerModule, SelectModule,
        InputTextModule, TableModule, TagModule, SkeletonModule, TablaEsqueletoComponent, AyudaCampoComponent
    ],
    templateUrl: './produccion-base.html',
    styleUrls: ['./produccion-base.scss']
})
export class ProduccionBasePage implements OnInit {
    private destroyRef = inject(DestroyRef);
    private recargar = new Subject<void>();
    private busqueda = new Subject<void>();
    private consultaAplicada: ConsultaProduccion = {};

    rango: Date[] | null = [new Date(new Date().getFullYear(), new Date().getMonth(), 1), new Date()];
    modalidad = '';
    productor: number | null = null;
    buscar = '';
    primero = 0;
    filas = 10;
    orden = 'fecha';
    direccion = -1;
    items: FilaProduccion[] = [];
    total = 0;
    resumen: ResumenProduccion | null = null;
    cargando = false;
    errorCarga = '';
    errorFiltro = '';
    productores: { id: number; nombre: string }[] = [];
    modalidades = [
        { label: 'Todas', value: '' },
        { label: 'Compra (propio)', value: 'COMPRA' },
        { label: 'Servicio a terceros', value: 'SERVICIO' }
    ];
    etapas = [
        { label: 'Descarguío', ruta: 'descarguios', icon: 'pi pi-download' },
        { label: 'Secado', ruta: 'secados', icon: 'pi pi-sun' },
        { label: 'Guardado', ruta: 'guardados', icon: 'pi pi-warehouse' },
        { label: 'Procesado', ruta: 'procesados', icon: 'pi pi-cog' },
        { label: 'Envasado', ruta: 'envasados', icon: 'pi pi-box' }
    ];
    accesosRapidos: { label: string; icon: string; ruta: string }[] = [];

    private readonly rutasTipo: Record<string, string> = {
        DESCARGUIO: 'descarguios',
        SECADO: 'secados',
        GUARDADO: 'guardados',
        PROCESADO: 'procesados',
        ENVASADO: 'envasados'
    };

    constructor(
        private api: ProduccionBaseService,
        private aviso: AvisoService,
        private router: Router
    ) {}

    get reportePagina(): string {
        return 'Mostrando {first} a {last} de {totalRecords} operaciones';
    }

    get indicadores(): KpiItem[] {
        const i = this.resumen?.indicadores;
        return [
            { label: 'Descarguíos por secar', value: String(i?.descarguios_por_secar ?? 0), icon: 'pi pi-download', tone: 'warn' },
            { label: 'Secados por guardar', value: String(i?.secados_por_guardar ?? 0), icon: 'pi pi-sun', tone: 'info' },
            { label: 'Lotes almacenados', value: String(i?.lotes_almacenados ?? 0), icon: 'pi pi-warehouse', tone: 'success' },
            { label: 'Procesados del período', value: String(i?.procesados ?? 0), icon: 'pi pi-cog', tone: 'neutral' }
        ];
    }

    irA(ruta: string): void {
        void this.router.navigateByUrl(ruta);
    }

    ngOnInit(): void {
        const items = [
            { label: 'Nuevo descarguío', icon: 'pi pi-plus', ruta: '/produccion/descarguios/nuevo', permiso: 'descarguios' },
            { label: 'Registrar secado', icon: 'pi pi-sun', ruta: '/produccion/secados/nuevo', permiso: 'secados' },
            { label: 'Registrar guardado', icon: 'pi pi-warehouse', ruta: '/produccion/guardados/nuevo', permiso: 'guardados' },
            { label: 'Nuevo procesado', icon: 'pi pi-cog', ruta: '/produccion/procesados/nuevo', permiso: 'procesados' },
            { label: 'Nuevo envasado', icon: 'pi pi-box', ruta: '/produccion/envasados/nuevo', permiso: 'envasados' }
        ];
        this.accesosRapidos = items
            .filter(a => permisoEtapa(a.permiso, 'escritura'))
            .map(({ label, icon, ruta }) => ({ label, icon, ruta }));

        this.recargar.pipe(
            tap(() => { this.cargando = true; this.errorCarga = ''; }),
            switchMap(() => forkJoin({
                listado: this.api.listado({
                    ...this.consultaAplicada,
                    buscar: this.buscar,
                    offset: this.primero,
                    limit: this.filas,
                    orden: this.orden,
                    direccion: this.direccion
                }),
                resumen: this.api.resumen(this.consultaAplicada)
            }).pipe(catchError(error => {
                this.errorCarga = this.aviso.error(error, 'No se pudo consultar Producción').mensaje;
                return of(null);
            }))),
            takeUntilDestroyed(this.destroyRef)
        ).subscribe(resultado => {
            this.cargando = false;
            this.items = resultado?.listado.items || [];
            this.total = resultado?.listado.total || 0;
            this.resumen = resultado?.resumen || null;
        });

        this.busqueda.pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
            this.primero = 0;
            this.solicitar();
        });

        this.api.catalogos().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: datos => this.productores = datos.productores,
            error: error => this.aviso.error(error, 'No se pudieron cargar los filtros de Producción')
        });

        this.consultar();
    }

    consultar(): void {
        this.errorFiltro = '';
        if (this.rango?.[0] && this.rango?.[1] && this.rango[0] > this.rango[1]) {
            this.errorFiltro = 'La fecha inicial no puede ser posterior a la final.';
            return;
        }
        this.consultaAplicada = {
            fecha_desde: this.fecha(this.rango?.[0]),
            fecha_hasta: this.fecha(this.rango?.[1] || this.rango?.[0]),
            modalidad: this.modalidad || undefined,
            id_productor: this.productor || undefined
        };
        this.primero = 0;
        this.solicitar();
    }

    solicitar(): void { this.recargar.next(); }
    cambioBusqueda(): void { this.busqueda.next(); }

    paginar(evento: TableLazyLoadEvent): void {
        const orden = typeof evento.sortField === 'string' ? evento.sortField : 'fecha';
        const direccion = evento.sortOrder === 1 ? 1 : -1;
        const cambioOrden = orden !== this.orden || direccion !== this.direccion;
        this.primero = cambioOrden ? 0 : (evento.first || 0);
        this.filas = evento.rows || 10;
        this.orden = orden;
        this.direccion = direccion;
        this.solicitar();
    }

    numero(valor: unknown): string {
        return valor == null ? '—' : new Intl.NumberFormat('es-BO', { maximumFractionDigits: 3 }).format(Number(valor));
    }

    etiqueta(valor: string): string {
        return ({
            DESCARGUIO: 'Descarguío', SECADO: 'Secado', GUARDADO: 'Guardado', PROCESADO: 'Procesado', ENVASADO: 'Envasado',
            BORRADOR: 'Borrador', CONFIRMADO: 'Confirmado', ANULADO: 'Anulado'
        } as Record<string, string>)[valor] || valor;
    }

    severidad(estado: string): 'success' | 'warn' | 'secondary' | 'info' {
        return estado === 'CONFIRMADO' ? 'success' : estado === 'BORRADOR' ? 'warn' : 'secondary';
    }

    iconoEstado(estado: string): string {
        return estado === 'CONFIRMADO' ? 'pi pi-check-circle' : estado === 'BORRADOR' ? 'pi pi-clock' : 'pi pi-ban';
    }

    rutaOperacion(item: FilaProduccion): string[] | null {
        const ruta = item.tipo ? this.rutasTipo[item.tipo] : null;
        return ruta && item.id ? ['/produccion', ruta, String(item.id)] : null;
    }

    private fecha(valor: Date | undefined | null): string | undefined {
        return valor
            ? `${valor.getFullYear()}-${String(valor.getMonth() + 1).padStart(2, '0')}-${String(valor.getDate()).padStart(2, '0')}`
            : undefined;
    }
}
