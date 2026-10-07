import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AvisoService } from '../../shared/services/aviso.service';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { apiUrl } from '../../core/utils/api-url';
import { imagenDefault } from '../../core/utils/media-url';
import { AyudaCampoComponent } from '../../shared/components/ayuda-campo';
import { EstadoVacioComponent } from '../../shared/components/estado-vacio';
import { InputNumeroComponent } from '../../shared/components/input-numero';
import { KpiGridComponent, KpiItem } from '../../shared/components/kpi-grid';
import { TablaBusquedaComponent } from '../../shared/components/tabla-busqueda';
import { TablaEsqueletoComponent } from '../../shared/components/tabla-esqueleto';
import { FILAS_TABLA, filtrarTabla } from '../../shared/utils/tabla';

/** Bolsas y empaques: existencia = entradas − salidas. No se mezcla con el arroz de los productores. */
@Component({
    selector: 'app-empaques',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, DialogModule, InputTextModule, TableModule, TagModule, TextareaModule, AyudaCampoComponent, EstadoVacioComponent, InputNumeroComponent, KpiGridComponent, TablaBusquedaComponent, TablaEsqueletoComponent],
    template: `
        <div class="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div class="min-w-0">
                <div class="text-surface-900 dark:text-surface-0 font-semibold text-2xl mb-1">Bolsas y empaques</div>
                <div class="text-muted-color">Tipos de bolsa, entradas, salidas y lo que queda en almacén.</div>
            </div>
            <p-button label="Nuevo tipo de bolsa" icon="pi pi-plus" (onClick)="abrirNuevo()" />
        </div>

        <app-kpi-grid [items]="kpis" [loading]="cargando" [columns]="3" [compact]="true" />

        <div class="card">
            <div class="flex flex-wrap items-end gap-3 mb-4">
                <div class="w-full lg:w-[18rem] min-w-0 lg:ml-auto">
                    <label class="block font-bold mb-1 text-sm">Buscar</label>
                    <app-tabla-busqueda placeholder="Buscar tipo de bolsa" (buscar)="filtrarTabla(dt, $event)" />
                </div>
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
                currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} tipos"
                [globalFilterFields]="['nombre', 'unidad_medida']"
                [rowHover]="true"
                sortMode="single"
                responsiveLayout="scroll"
            >
                <ng-template #header>
                    <tr><th>Tipo de bolsa</th><th>Unidad</th><th>Entradas</th><th>Salidas</th><th>Existencia</th><th>Mínimo</th><th></th></tr>
                </ng-template>
                <ng-template #body let-p>
                    <tr>
                        <td>{{ p.nombre }}</td>
                        <td>{{ p.unidad_medida }}</td>
                        <td>{{ p.entradas }}</td>
                        <td>{{ p.salidas }}</td>
                        <td><p-tag [value]="p.stock" [severity]="p.bajo_minimo ? 'danger' : 'success'" /></td>
                        <td>{{ p.stock_minimo }}</td>
                        <td>
                            <div class="flex flex-wrap gap-2 justify-end">
                                <p-button label="Entrada" icon="pi pi-plus" size="small" [outlined]="true" (onClick)="abrirMovimiento(p, 'ENTRADA')" />
                                <p-button label="Salida" icon="pi pi-minus" size="small" severity="secondary" [outlined]="true" (onClick)="abrirMovimiento(p, 'SALIDA')" />
                                <p-button icon="pi pi-list" size="small" [text]="true" severity="secondary" ariaLabel="Ver movimientos" (onClick)="verKardex(p)" />
                            </div>
                        </td>
                    </tr>
                </ng-template>
                <ng-template #loadingbody>
                    <tr *ngFor="let f of [0,1,2,3,4]" app-tabla-esqueleto [columnas]="7" [fila]="f"></tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr><td colspan="7"><app-estado-vacio icono="pi pi-inbox" titulo="No hay tipos de bolsa" mensaje="Crea los tipos que usas (arpillera 46 kg, bolsa 50 kg) y registra sus entradas." /></td></tr>
                </ng-template>
            </p-table>
        </div>

        <p-dialog [header]="form.id ? 'Editar tipo de bolsa' : 'Nuevo tipo de bolsa'" [(visible)]="dialog" [modal]="true" [style]="{ width: '30rem' }" [breakpoints]="{ '960px': '95vw' }">
            <div class="flex flex-col gap-4">
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Nombre <app-ayuda-campo texto="Ej.: Arpillera 46 kg, Bolsa plástica 50 kg." posicion="right" /></label>
                    <input pInputText class="w-full" [(ngModel)]="form.nombre" />
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Unidad <app-ayuda-campo texto="Normalmente unidad. Es cómo contás las bolsas." posicion="right" /></label>
                    <input pInputText class="w-full" [(ngModel)]="form.unidad_medida" />
                </div>
                <div *ngIf="!form.id">
                    <label class="flex items-center gap-1 font-bold mb-2">Existencia inicial <app-ayuda-campo texto="Bolsas que ya tenés en almacén hoy. Luego registrá entradas y salidas." posicion="right" /></label>
                    <app-input-numero tipo="cantidad" [(ngModel)]="form.stock" [min]="0" />
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Aviso de stock mínimo <app-ayuda-campo texto="Avisa en rojo cuando queden menos bolsas que este número." posicion="right" /></label>
                    <app-input-numero tipo="cantidad" [(ngModel)]="form.stock_minimo" [min]="0" />
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Precio de compra <app-ayuda-campo texto="Costo de referencia por bolsa. Opcional." posicion="right" /></label>
                    <app-input-numero [(ngModel)]="form.precio_compra" />
                </div>
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="dialog = false" />
                <p-button label="Guardar" [loading]="guardando" (onClick)="guardar()" />
            </ng-template>
        </p-dialog>

        <p-dialog [header]="tipoMovimiento === 'ENTRADA' ? 'Registrar entrada de bolsas' : 'Registrar salida de bolsas'" [(visible)]="dialogMovimiento" [modal]="true" [style]="{ width: '28rem' }" [breakpoints]="{ '960px': '95vw' }">
            <div class="flex flex-col gap-4" *ngIf="productoMovimiento">
                <div class="text-sm">
                    <div class="font-semibold">{{ productoMovimiento.nombre }}</div>
                    <div class="text-muted-color">Existencia actual: {{ productoMovimiento.stock }}</div>
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Cantidad <app-ayuda-campo [texto]="tipoMovimiento === 'ENTRADA' ? 'Bolsas que entran al almacén.' : 'Bolsas que salen para embolsar o se dan de baja.'" posicion="right" /></label>
                    <app-input-numero tipo="cantidad" [(ngModel)]="cantidadMovimiento" [min]="0" />
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Observación <app-ayuda-campo texto="Motivo: compra, consumo de embolsado, rotura." posicion="top" /></label>
                    <textarea pTextarea class="w-full" rows="2" [(ngModel)]="observacionMovimiento"></textarea>
                </div>
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="dialogMovimiento = false" />
                <p-button label="Guardar" [loading]="guardando" (onClick)="guardarMovimiento()" />
            </ng-template>
        </p-dialog>

        <p-dialog header="Movimientos de bolsas" [(visible)]="dialogKardex" [modal]="true" [style]="{ width: '46rem' }" [breakpoints]="{ '960px': '95vw' }">
            <p-table [value]="kardex" [paginator]="kardex.length > 8" [rows]="8" [rowsPerPageOptions]="filasTabla" [rowHover]="true" responsiveLayout="scroll">
                <ng-template #header><tr><th>Fecha</th><th>Movimiento</th><th>Cantidad</th><th>Existencia</th><th>Observación</th></tr></ng-template>
                <ng-template #body let-k>
                    <tr>
                        <td>{{ k.fecha | date:'short' }}</td>
                        <td><p-tag [value]="k.tipo === 'SALIDA' ? 'Salida' : 'Entrada'" [severity]="k.tipo === 'SALIDA' ? 'warn' : 'success'" /></td>
                        <td>{{ k.cantidad }}</td>
                        <td>{{ k.stock_resultante }}</td>
                        <td>{{ k.observacion || '-' }}</td>
                    </tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr><td colspan="5"><div class="text-center py-6 text-muted-color">Sin movimientos registrados.</div></td></tr>
                </ng-template>
            </p-table>
        </p-dialog>
    `
})
export class EmpaquesPage implements OnInit {
    filasTabla = FILAS_TABLA;
    filtrarTabla = filtrarTabla;
    items: any[] = [];
    kardex: any[] = [];
    idCategoria: number | null = null;
    cargando = false;
    guardando = false;
    dialog = false;
    dialogMovimiento = false;
    dialogKardex = false;
    form: any = this.vacio();
    productoMovimiento: any = null;
    tipoMovimiento: 'ENTRADA' | 'SALIDA' = 'ENTRADA';
    cantidadMovimiento = 0;
    observacionMovimiento = '';

    constructor(private http: HttpClient, private aviso: AvisoService) {}

    ngOnInit(): void {
        this.http.get<any[]>(apiUrl('/api/productos/categorias')).subscribe({
            next: (categorias) => {
                this.idCategoria = categorias.find((c) => c.nombre === 'Empaque')?.id ?? null;
                this.cargar();
            },
            error: (e) => this.aviso.error(e, 'No se pudieron cargar las categorías')
        });
    }

    get kpis(): KpiItem[] {
        const existencia = this.items.reduce((acc, p) => acc + Number(p.stock || 0), 0);
        const entradas = this.items.reduce((acc, p) => acc + Number(p.entradas || 0), 0);
        const salidas = this.items.reduce((acc, p) => acc + Number(p.salidas || 0), 0);
        return [
            { label: 'Entradas acumuladas', value: String(entradas), icon: 'pi pi-download', tone: 'success' },
            { label: 'Salidas acumuladas', value: String(salidas), icon: 'pi pi-upload', tone: 'warn' },
            { label: 'Existencia en almacén', value: String(existencia), icon: 'pi pi-inbox', tone: 'info' }
        ];
    }

    cargar(): void {
        if (!this.idCategoria) {
            this.items = [];
            return;
        }
        this.cargando = true;
        this.http.get<any[]>(apiUrl('/api/productos'), { params: { id_categoria: String(this.idCategoria), totales: '1' } }).subscribe({
            next: (d) => { this.items = d; this.cargando = false; },
            error: (e) => { this.cargando = false; this.aviso.error(e, 'No se pudo cargar el inventario de bolsas'); }
        });
    }

    abrirNuevo(): void {
        this.form = this.vacio();
        this.dialog = true;
    }

    guardar(): void {
        if (!this.form.nombre?.trim()) {
            this.aviso.aviso('Validación', 'El nombre del tipo de bolsa es obligatorio');
            return;
        }
        if (!this.idCategoria) {
            this.aviso.aviso('Validación', 'No existe la categoría Empaque en el inventario');
            return;
        }
        this.guardando = true;
        const payload = {
            nombre: this.form.nombre.trim(),
            descripcion: '',
            precio_venta: 0,
            precio_compra: this.form.precio_compra || 0,
            stock: this.form.stock || 0,
            stock_minimo: this.form.stock_minimo || 0,
            unidad_medida: this.form.unidad_medida || 'unidad',
            path_imagen: imagenDefault('producto'),
            id_categoria: this.idCategoria
        };
        const stockInicial = !this.form.id ? Number(this.form.stock || 0) : 0;
        const req = this.form.id
            ? this.http.put<{ mensaje: string; data?: { id: number } }>(apiUrl(`/api/productos/${this.form.id}`), payload)
            : this.http.post<{ mensaje: string; data?: { id: number } }>(apiUrl('/api/productos'), { ...payload, stock: 0 });
        req.subscribe({
            next: (res) => {
                const idNuevo = res.data?.id;
                if (idNuevo && stockInicial > 0) {
                    this.http.post(apiUrl(`/api/productos/${idNuevo}/ajuste`), {
                        cantidad: stockInicial,
                        observacion: 'Existencia inicial'
                    }).subscribe({
                        next: () => { this.guardando = false; this.dialog = false; this.aviso.ok('Listo', res.mensaje); this.cargar(); },
                        error: (e) => { this.guardando = false; this.aviso.error(e, 'Se creó el tipo, pero no se registró la existencia inicial'); this.cargar(); }
                    });
                    return;
                }
                this.guardando = false;
                this.dialog = false;
                this.aviso.ok('Listo', res.mensaje);
                this.cargar();
            },
            error: (e) => { this.guardando = false; this.aviso.error(e, 'No se pudo guardar'); }
        });
    }

    abrirMovimiento(p: any, tipo: 'ENTRADA' | 'SALIDA'): void {
        this.productoMovimiento = p;
        this.tipoMovimiento = tipo;
        this.cantidadMovimiento = 0;
        this.observacionMovimiento = '';
        this.dialogMovimiento = true;
    }

    guardarMovimiento(): void {
        if (!this.productoMovimiento || !this.cantidadMovimiento) {
            this.aviso.aviso('Validación', 'Indique la cantidad de bolsas');
            return;
        }
        const cantidad = Math.abs(this.cantidadMovimiento);
        if (this.tipoMovimiento === 'SALIDA' && cantidad > Number(this.productoMovimiento.stock || 0)) {
            this.aviso.aviso('Validación', 'No hay suficientes bolsas en almacén');
            return;
        }
        this.guardando = true;
        this.http.post<{ mensaje: string }>(apiUrl(`/api/productos/${this.productoMovimiento.id}/ajuste`), {
            cantidad: this.tipoMovimiento === 'SALIDA' ? -cantidad : cantidad,
            observacion: this.observacionMovimiento || undefined
        }).subscribe({
            next: () => {
                this.guardando = false;
                this.dialogMovimiento = false;
                this.aviso.ok('Listo', this.tipoMovimiento === 'SALIDA' ? 'Salida registrada' : 'Entrada registrada');
                this.cargar();
            },
            error: (e) => { this.guardando = false; this.aviso.error(e, 'No se pudo registrar el movimiento'); }
        });
    }

    verKardex(p: any): void {
        this.http.get<any[]>(apiUrl(`/api/productos/kardex/${p.id}`)).subscribe({
            next: (d) => { this.kardex = d; this.dialogKardex = true; },
            error: (e) => this.aviso.error(e, 'No se pudo cargar los movimientos')
        });
    }

    private vacio() {
        return { id: 0, nombre: '', unidad_medida: 'unidad', stock: 0, stock_minimo: 0, precio_compra: 0 };
    }
}
