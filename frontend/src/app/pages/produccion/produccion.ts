import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AvisoService } from '../../shared/services/aviso.service';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TextareaModule } from 'primeng/textarea';
import { apiUrl } from '../../core/utils/api-url';
import { formatFecha } from '../caja/caja.utils';
import { TablaEsqueletoComponent } from '../../shared/components/tabla-esqueleto';
import { AyudaCampoComponent } from '../../shared/components/ayuda-campo';
import { InputNumeroComponent } from '../../shared/components/input-numero';
import { TablaBusquedaComponent } from '../../shared/components/tabla-busqueda';
import { BotonesExportarComponent } from '../../shared/components/botones-exportar';
import { FILAS_TABLA, filtrarTabla } from '../../shared/utils/tabla';
import { ymdDesdeRango, ymdHastaRango } from '../../shared/utils/fecha-filtro';

@Component({
    selector: 'app-produccion',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, DatePickerModule, DialogModule, SelectModule, TableModule, TextareaModule, TablaEsqueletoComponent, AyudaCampoComponent, InputNumeroComponent, TablaBusquedaComponent, BotonesExportarComponent],
    template: `
        <div class="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div class="min-w-0">
                <div class="text-surface-900 dark:text-surface-0 font-semibold text-2xl mb-1">Producción</div>
                <div class="text-muted-color">Convierte materia prima (chala) en producto terminado</div>
            </div>
            <p-button label="Nueva producción" icon="pi pi-plus" (onClick)="dialog = true" />
        </div>
        <div class="card">
            <div class="barra-listado">
                <div class="campo-fecha">
                    <label class="block font-bold mb-1 text-sm">Período</label>
                    <p-datepicker selectionMode="range" [(ngModel)]="rango" dateFormat="dd/mm/yy" [showIcon]="true" iconDisplay="input" [readonlyInput]="true" placeholder="Fechas" fluid />
                </div>
                <p-button label="Consultar" icon="pi pi-filter" (onClick)="cargar()" [loading]="cargando" />
                <div class="campo-buscar">
                    <label class="block font-bold mb-1 text-sm">Buscar</label>
                    <app-tabla-busqueda placeholder="Buscar..." (buscar)="filtrarTabla(dt, $event)" />
                </div>
                <app-botones-exportar tipo="produccion" [fechaDesde]="fechaDesde" [fechaHasta]="fechaHasta" />
            </div>
            <p-table
                #dt
                [value]="cargando ? [] : items"
                [loading]="cargando"
                [showLoader]="false"
                [paginator]="true"
                [alwaysShowPaginator]="true"
                [rows]="10"
                [rowsPerPageOptions]="filasTabla"
                [showCurrentPageReport]="true"
                currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} producciones"
                [globalFilterFields]="['fecha', 'producto_origen.nombre', 'producto_destino.nombre']"
                [rowHover]="true"
                sortMode="single"
                responsiveLayout="scroll"
            >
                <ng-template #header>
                    <tr><th>Fecha</th><th>Origen</th><th>Entrada</th><th>Destino</th><th>Salida</th><th>Merma</th></tr>
                </ng-template>
                <ng-template #body let-p>
                    <tr>
                        <td>{{ formatFecha(p.fecha) }}</td>
                        <td>{{ p.producto_origen?.nombre }}</td>
                        <td>{{ p.cantidad_entrada }}</td>
                        <td>{{ p.producto_destino?.nombre }}</td>
                        <td>{{ p.cantidad_salida }}</td>
                        <td>{{ p.merma }}</td>
                    </tr>
                </ng-template>
                <ng-template #loadingbody>
                    <tr *ngFor="let f of [0,1,2,3,4,5,6,7]" app-tabla-esqueleto [columnas]="6" [fila]="f"></tr>
                </ng-template>
            </p-table>
        </div>
        <p-dialog header="Registrar producción" [(visible)]="dialog" [modal]="true" [style]="{ width: '32rem' }" [breakpoints]="{ '960px': '95vw' }">
            <div class="flex flex-col gap-3">
                <div><label class="flex items-center gap-1 font-bold mb-2">Producto origen <app-ayuda-campo texto="Materia prima que se consume (ej. chala). Baja del inventario." posicion="right" /></label><p-select [options]="productos" optionLabel="nombre" optionValue="id" [(ngModel)]="form.id_producto_origen" fluid appendTo="body" [baseZIndex]="2100" /></div>
                <div><label class="flex items-center gap-1 font-bold mb-2">Cantidad entrada <app-ayuda-campo texto="Cuánto origen se usa. Debe haber stock." posicion="right" /></label><app-input-numero tipo="cantidad" [(ngModel)]="form.cantidad_entrada" [min]="0" /></div>
                <div><label class="flex items-center gap-1 font-bold mb-2">Producto destino <app-ayuda-campo texto="Producto que sale del proceso (ej. arroz pilado). Entra al inventario." posicion="right" /></label><p-select [options]="productos" optionLabel="nombre" optionValue="id" [(ngModel)]="form.id_producto_destino" fluid appendTo="body" [baseZIndex]="2100" /></div>
                <div><label class="flex items-center gap-1 font-bold mb-2">Cantidad salida <app-ayuda-campo texto="Cuánto producto terminado se obtiene. Puede ser distinta a la entrada." posicion="right" /></label><app-input-numero tipo="cantidad" [(ngModel)]="form.cantidad_salida" [min]="0" /></div>
                <div><label class="flex items-center gap-1 font-bold mb-2">Observación <app-ayuda-campo texto="Turno, merma, lote, etc." posicion="top" /></label><textarea pTextarea class="w-full" rows="2" [(ngModel)]="form.observacion"></textarea></div>
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="dialog = false" />
                <p-button label="Guardar" [loading]="guardando" (onClick)="guardar()" />
            </ng-template>
        </p-dialog>
    `
})
export class ProduccionPage implements OnInit {
    filasTabla = FILAS_TABLA;
    filtrarTabla = filtrarTabla;
    items: any[] = [];
    productos: any[] = [];
    rango: Date[] | null = null;
    cargando = false;
    guardando = false;
    dialog = false;
    form: any = {};
    formatFecha = formatFecha;

    constructor(private http: HttpClient, private aviso: AvisoService) {}

    ngOnInit(): void {
        this.http.get<any[]>(apiUrl('/api/productos')).subscribe({ next: (d) => (this.productos = d) });
        this.cargar();
    }

    get fechaDesde(): string | undefined {
        return ymdDesdeRango(this.rango);
    }

    get fechaHasta(): string | undefined {
        return ymdHastaRango(this.rango);
    }

    cargar(): void {
        this.cargando = true;
        const params: { fecha_desde?: string; fecha_hasta?: string } = {};
        if (this.fechaDesde) {
            params.fecha_desde = this.fechaDesde;
        }
        if (this.fechaHasta) {
            params.fecha_hasta = this.fechaHasta;
        }
        this.http.get<any[]>(apiUrl('/api/producciones'), { params }).subscribe({
            next: (d) => { this.items = d; this.cargando = false; },
            error: (e) => { this.cargando = false; this.aviso.error(e, 'No se pudo completar la operación'); }
        });
    }

    guardar(): void {
        this.guardando = true;
        this.http.post<{ mensaje: string }>(apiUrl('/api/producciones'), this.form).subscribe({
            next: (res) => { this.guardando = false; this.dialog = false; this.aviso.ok('Listo', res.mensaje); this.cargar(); },
            error: (e) => { this.guardando = false; this.aviso.error(e, 'No se pudo registrar la producción'); }
        });
    }
}
