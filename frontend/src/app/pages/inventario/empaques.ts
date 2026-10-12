import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { APP_ROUTES } from '../../core/constants/app-routes';
import { AvisoService } from '../../shared/services/aviso.service';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
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
import { BotonesExportarComponent } from '../../shared/components/botones-exportar';
import { TablaEsqueletoComponent } from '../../shared/components/tabla-esqueleto';
import { FILAS_TABLA, filtrarTabla } from '../../shared/utils/tabla';
import { esUnidadMedidaValida, MENSAJE_UNIDAD_MEDIDA, UNIDADES_MEDIDA } from '../../shared/utils/unidad-medida';

/** Bolsas y empaques: existencia = entradas − salidas. No se mezcla con el arroz de los productores. */
@Component({
    selector: 'app-empaques',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, DialogModule, IconFieldModule, InputIconModule, InputTextModule, SelectModule, TableModule, TagModule, TextareaModule, AyudaCampoComponent, EstadoVacioComponent, InputNumeroComponent, KpiGridComponent, TablaBusquedaComponent, TablaEsqueletoComponent, BotonesExportarComponent],
    template: `
        <div class="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div class="min-w-0">
                <div class="text-surface-900 dark:text-surface-0 font-semibold text-2xl mb-1">Bolsas y empaques</div>
                <div class="text-muted-color">Tipos de bolsa, salidas y existencia. Las entradas se registran comprando en Compras.</div>
            </div>
            <p-button label="Nuevo tipo de bolsa" icon="pi pi-plus" (onClick)="abrirNuevo()" />
        </div>

        <app-kpi-grid [items]="kpis" [loading]="cargando" [columns]="3" [compact]="true" />

        <div class="card mb-4" *ngIf="unidadesInvalidas.length">
            <div class="font-semibold mb-1">Unidades de medida inválidas</div>
            <p class="text-muted-color text-sm mt-0 mb-2">Estos tipos de bolsa tienen una unidad solo numérica. No se corrigieron automáticamente. {{ mensajeUnidad }}</p>
            <ul class="m-0 pl-5 text-sm">
                <li *ngFor="let p of unidadesInvalidas">{{ p.nombre }} · «{{ p.unidad_medida }}»</li>
            </ul>
        </div>

        <div class="card">
            <div class="barra-listado">
                <div class="campo">
                    <label class="block font-bold mb-1 text-sm">Existencia</label>
                    <p-select [options]="estadosStock" optionLabel="label" optionValue="value" [(ngModel)]="filtroStock" placeholder="Todas" fluid appendTo="body" />
                </div>
                <div class="campo-buscar">
                    <label class="block font-bold mb-1 text-sm">Buscar</label>
                    <app-tabla-busqueda placeholder="Buscar tipo de bolsa" (buscar)="filtrarTabla(dt, $event)" />
                </div>
                <app-botones-exportar tipo="empaques" [estado]="filtroStock" />
            </div>
            <p-table
                #dt
                [value]="cargando ? [] : itemsFiltrados"
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
                        <td [class.text-red-500]="!esUnidadValida(p.unidad_medida)">{{ p.unidad_medida }}</td>
                        <td>{{ p.entradas }}</td>
                        <td>{{ p.salidas }}</td>
                        <td><p-tag [value]="p.stock" [severity]="p.bajo_minimo ? 'danger' : 'success'" /></td>
                        <td>{{ p.stock_minimo }}</td>
                        <td>
                            <div class="flex flex-wrap gap-2 justify-end">
                                <p-button label="Comprar" icon="pi pi-plus" size="small" [outlined]="true" (onClick)="irAComprar(p)" />
                                <p-button label="Salida" icon="pi pi-minus" size="small" severity="secondary" [outlined]="true" (onClick)="abrirSalida(p)" />
                                <p-button icon="pi pi-list" size="small" [text]="true" severity="secondary" ariaLabel="Ver movimientos" (onClick)="verKardex(p)" />
                            </div>
                        </td>
                    </tr>
                </ng-template>
                <ng-template #loadingbody>
                    <tr *ngFor="let f of [0,1,2,3,4]" app-tabla-esqueleto [columnas]="7" [fila]="f"></tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr><td colspan="7"><app-estado-vacio icono="pi pi-inbox" titulo="No hay tipos de bolsa" mensaje="Crea los tipos que usas (arpillera 46 kg, bolsa 50 kg). Las entradas se compran en Compras." /></td></tr>
                </ng-template>
            </p-table>
        </div>

        <p-dialog [header]="form.id ? 'Editar tipo de bolsa' : 'Nuevo tipo de bolsa'" [(visible)]="dialog" [modal]="true" [style]="{ width: '30rem' }" [breakpoints]="{ '960px': '95vw' }">
            <div class="flex flex-col gap-4">
                <div class="campo-form">
                    <label class="flex items-center gap-1 font-bold mb-2">Nombre <app-ayuda-campo texto="Ej.: Arpillera 46 kg, Bolsa plástica 50 kg." posicion="right" /></label>
                    <p-iconfield iconPosition="right">
                        <input pInputText class="w-full" name="nombreBolsa" [(ngModel)]="form.nombre" (blur)="tocadoNombre = true" [class.ng-dirty]="mostrarNombre" [class.ng-invalid]="!!errorNombre" [class.ng-valid]="okNombre" />
                        <p-inputicon [styleClass]="okNombre ? 'pi pi-check text-green-500' : errorNombre ? 'pi pi-times text-red-500' : ''" />
                    </p-iconfield>
                    <div class="campo-feedback-error" *ngIf="errorNombre">{{ errorNombre }}</div>
                    <div class="campo-feedback-ok" *ngIf="okNombre">Correcto</div>
                </div>
                <div class="campo-form">
                    <label class="block font-bold mb-1">Unidad de medida</label>
                    <p class="text-xs text-muted-color mt-0 mb-2">Kilo, Fanega, Quintal o Unidad. La cantidad va en otro campo.</p>
                    <p-select
                        [options]="unidades"
                        optionLabel="label"
                        optionValue="value"
                        [(ngModel)]="form.unidad_medida"
                        placeholder="Elegí la unidad"
                        [styleClass]="okUnidad ? 'ng-dirty ng-valid' : errorUnidad ? 'ng-dirty ng-invalid' : ''"
                        fluid
                        appendTo="body"
                        [baseZIndex]="2100"
                        (onChange)="tocadoUnidad = true"
                    />
                    <div class="campo-feedback-error" *ngIf="errorUnidad">{{ errorUnidad }}</div>
                    <div class="campo-feedback-ok" *ngIf="okUnidad">Correcto</div>
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

        <p-dialog header="Registrar salida de bolsas" [(visible)]="dialogMovimiento" [modal]="true" [style]="{ width: '28rem' }" [breakpoints]="{ '960px': '95vw' }">
            <div class="flex flex-col gap-4" *ngIf="productoMovimiento">
                <div class="text-sm">
                    <div class="font-semibold">{{ productoMovimiento.nombre }}</div>
                    <div class="text-muted-color">Existencia actual: {{ productoMovimiento.stock }}</div>
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Cantidad <app-ayuda-campo texto="Bolsas que salen para embolsar o se dan de baja." posicion="right" /></label>
                    <app-input-numero tipo="cantidad" [(ngModel)]="cantidadMovimiento" [min]="0" />
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Observación <app-ayuda-campo texto="Motivo: consumo de embolsado, rotura." posicion="top" /></label>
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
                        <td><p-tag [value]="etiquetaMovimiento(k)" [severity]="k.tipo === 'SALIDA' ? 'warn' : 'success'" /></td>
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
    filtroStock = '';
    estadosStock = [
        { label: 'Todas', value: '' },
        { label: 'Bajo mínimo', value: 'BAJO' },
        { label: 'En rango', value: 'OK' }
    ];
    kardex: any[] = [];
    idCategoria: number | null = null;
    cargando = false;
    guardando = false;
    dialog = false;
    dialogMovimiento = false;
    dialogKardex = false;
    form: any = this.vacio();
    productoMovimiento: any = null;
    cantidadMovimiento = 0;
    observacionMovimiento = '';
    mensajeUnidad = MENSAJE_UNIDAD_MEDIDA;
    unidades = UNIDADES_MEDIDA;
    enviado = false;
    tocadoNombre = false;
    tocadoUnidad = false;

    constructor(private http: HttpClient, private aviso: AvisoService, private router: Router) {}

    get unidadesInvalidas(): any[] {
        return this.items.filter((p) => !esUnidadMedidaValida(p.unidad_medida));
    }

    esUnidadValida(valor: string): boolean {
        return esUnidadMedidaValida(valor);
    }

    etiquetaMovimiento(k: { tipo?: string; origen?: string }): string {
        if (k.tipo === 'SALIDA') {
            return 'Salida';
        }
        if (k.origen === 'COMPRA') {
            return 'Compra';
        }
        return 'Ajuste';
    }

    get mostrarNombre(): boolean {
        return this.enviado || this.tocadoNombre;
    }

    get mostrarUnidad(): boolean {
        return this.enviado || this.tocadoUnidad;
    }

    get errorNombre(): string | null {
        if (!this.mostrarNombre) {
            return null;
        }
        return this.form.nombre?.trim() ? null : 'El nombre es obligatorio.';
    }

    get okNombre(): boolean {
        return this.mostrarNombre && !this.errorNombre;
    }

    get errorUnidad(): string | null {
        if (!this.mostrarUnidad) {
            return null;
        }
        return esUnidadMedidaValida(this.form.unidad_medida) ? null : MENSAJE_UNIDAD_MEDIDA;
    }

    get okUnidad(): boolean {
        return this.mostrarUnidad && !this.errorUnidad;
    }

    ngOnInit(): void {
        this.http.get<any[]>(apiUrl('/api/productos/categorias')).subscribe({
            next: (categorias) => {
                this.idCategoria = categorias.find((c) => c.nombre === 'Empaque')?.id ?? null;
                this.cargar();
            },
            error: (e) => this.aviso.error(e, 'No se pudieron cargar las categorías')
        });
    }

    get itemsFiltrados(): any[] {
        if (this.filtroStock === 'BAJO') {
            return this.items.filter((p) => p.bajo_minimo);
        }
        if (this.filtroStock === 'OK') {
            return this.items.filter((p) => !p.bajo_minimo);
        }
        return this.items;
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
        this.enviado = false;
        this.tocadoNombre = false;
        this.tocadoUnidad = false;
        this.dialog = true;
    }

    guardar(): void {
        this.enviado = true;
        if (this.errorNombre || this.errorUnidad) {
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
            stock: 0,
            stock_minimo: this.form.stock_minimo || 0,
            unidad_medida: this.form.unidad_medida,
            path_imagen: imagenDefault('producto'),
            id_categoria: this.idCategoria
        };
        const req = this.form.id
            ? this.http.put<{ mensaje: string; data?: { id: number } }>(apiUrl(`/api/productos/${this.form.id}`), payload)
            : this.http.post<{ mensaje: string; data?: { id: number } }>(apiUrl('/api/productos'), payload);
        req.subscribe({
            next: (res) => {
                this.guardando = false;
                this.dialog = false;
                this.aviso.ok('Listo', res.mensaje);
                this.cargar();
            },
            error: (e) => { this.guardando = false; this.aviso.error(e, 'No se pudo guardar'); }
        });
    }

    irAComprar(p: any): void {
        this.router.navigate([APP_ROUTES.compras], {
            queryParams: { nueva: 1, tipo: 'BOLSAS', producto: p.id }
        });
    }

    abrirSalida(p: any): void {
        this.productoMovimiento = p;
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
        if (cantidad > Number(this.productoMovimiento.stock || 0)) {
            this.aviso.aviso('Validación', 'No hay suficientes bolsas en almacén');
            return;
        }
        this.guardando = true;
        this.http.post<{ mensaje: string }>(apiUrl(`/api/productos/${this.productoMovimiento.id}/ajuste`), {
            cantidad: -cantidad,
            observacion: this.observacionMovimiento || undefined
        }).subscribe({
            next: () => {
                this.guardando = false;
                this.dialogMovimiento = false;
                this.aviso.ok('Listo', 'Salida registrada');
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
        return { id: 0, nombre: '', unidad_medida: 'Unidad', stock_minimo: 0, precio_compra: 0 };
    }
}
