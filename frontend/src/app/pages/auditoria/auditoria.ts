import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject, catchError, debounceTime, of, switchMap, tap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { TablaEsqueletoComponent } from '../../shared/components/tabla-esqueleto';
import { AvisoService } from '../../shared/services/aviso.service';
import { AuditoriaService, FilaAuditoria, ListadoAuditoria } from './auditoria.service';

@Component({
    selector: 'app-auditoria',
    standalone: true,
    imports: [
        CommonModule, FormsModule, RouterModule, ButtonModule, DatePickerModule, InputTextModule,
        MultiSelectModule, TableModule, TagModule, TooltipModule, TablaEsqueletoComponent
    ],
    templateUrl: './auditoria.html'
})
export class AuditoriaPage implements OnInit {
    private destroy = inject(DestroyRef);
    private router = inject(Router);
    desde: Date | null = null;
    hasta: Date | null = null;
    evento: string[] = [];
    tipo: string[] = [];
    buscar = '';
    eventos: { value: string; label: string }[] = [];
    tipos: { value: string; label: string }[] = [];
    resultado: ListadoAuditoria | null = null;
    cargando = false;
    error = '';
    primero = 0;
    filas = 25;
    orden = 'fecha';
    direccion = -1;
    recargar = new Subject<void>();
    buscarCambios = new Subject<void>();

    constructor(private api: AuditoriaService, private aviso: AvisoService) {}

    ngOnInit() {
        this.recargar.pipe(
            tap(() => { this.cargando = true; this.error = ''; }),
            switchMap(() => this.api.listar(this.query()).pipe(
                catchError(e => {
                    this.error = this.aviso.error(e, 'No se pudo cargar la auditoría').mensaje;
                    return of(null);
                })
            )),
            takeUntilDestroyed(this.destroy)
        ).subscribe(r => {
            this.resultado = r;
            if (r?.filtros) {
                this.eventos = r.filtros.eventos || [];
                this.tipos = r.filtros.tipos || [];
            }
            this.cargando = false;
        });
        this.buscarCambios.pipe(debounceTime(350), takeUntilDestroyed(this.destroy)).subscribe(() => {
            this.primero = 0;
            this.recargar.next();
        });
        this.consultar();
    }

    private ymd(d: Date | null) {
        return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : undefined;
    }

    consultar() {
        if (this.desde && this.hasta && this.desde > this.hasta) {
            this.error = 'Desde no puede ser posterior a Hasta.';
            return;
        }
        this.primero = 0;
        this.recargar.next();
    }

    limpiar() {
        this.desde = null;
        this.hasta = null;
        this.evento = [];
        this.tipo = [];
        this.buscar = '';
        this.consultar();
    }

    query() {
        return {
            fecha_desde: this.ymd(this.desde),
            fecha_hasta: this.ymd(this.hasta),
            evento: this.evento?.join(',') || undefined,
            tipo: this.tipo?.join(',') || undefined,
            buscar: this.buscar.trim() || undefined,
            orden: this.orden,
            direccion: this.direccion,
            limit: this.filas,
            offset: this.primero
        };
    }

    paginar(e: TableLazyLoadEvent) {
        this.primero = e.first || 0;
        this.filas = e.rows || 25;
        this.orden = typeof e.sortField === 'string' ? e.sortField : 'fecha';
        this.direccion = e.sortOrder === 1 ? 1 : -1;
        this.recargar.next();
    }

    severidad(evento: string) {
        if (evento === 'CONFIRMAR') return 'success';
        if (evento === 'ANULAR') return 'danger';
        if (evento === 'EDITAR_BORRADOR') return 'warn';
        return 'secondary';
    }

    abrir(fila: FilaAuditoria) {
        if (!fila.ruta) return;
        void this.router.navigateByUrl(fila.ruta);
    }
}
