import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { APP_ROUTES } from '../../core/constants/app-routes';
import { esProductoEmpaque } from '../../shared/utils/empaque';
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
import { imagenDefault, mediaUrl } from '../../core/utils/media-url';
import { formatBs } from '../caja/caja.utils';
import { ImagenCampoComponent } from '../../shared/components/imagen-campo';
import { BotonesExportarComponent } from '../../shared/components/botones-exportar';
import { TablaEsqueletoComponent } from '../../shared/components/tabla-esqueleto';
import { AyudaCampoComponent } from '../../shared/components/ayuda-campo';
import { InputNumeroComponent } from '../../shared/components/input-numero';
import { TooltipModule } from 'primeng/tooltip';
import { Menu, MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { TablaBusquedaComponent } from '../../shared/components/tabla-busqueda';
import { FILAS_TABLA, filtrarTabla } from '../../shared/utils/tabla';
import { esUnidadMedidaValida, MENSAJE_UNIDAD_MEDIDA, UNIDADES_MEDIDA, normalizarUnidadMedida } from '../../shared/utils/unidad-medida';
import { ProductosService } from './productos.service';

@Component({
    selector: 'app-inventario',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, DialogModule, IconFieldModule, InputIconModule, InputTextModule, SelectModule, TableModule, TagModule, TextareaModule, ImagenCampoComponent, BotonesExportarComponent, TablaEsqueletoComponent, AyudaCampoComponent, InputNumeroComponent, TooltipModule, MenuModule, TablaBusquedaComponent],
    template: `
        <p-menu #menuAcciones [popup]="true" [model]="itemsAcciones" [appendTo]="'body'" [baseZIndex]="1200" />
        <div class="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div class="min-w-0">
                <div class="text-surface-900 dark:text-surface-0 font-semibold text-2xl mb-1">Inventario</div>
                <div class="text-muted-color">Productos, stock mínimo y ajustes</div>
            </div>
            <p-button label="Nuevo producto" icon="pi pi-plus" (onClick)="abrirNuevo()" />
        </div>
        <div class="card mb-4" *ngIf="unidadesInvalidas.length">
            <div class="font-semibold mb-1">Unidades de medida inválidas</div>
            <p class="text-muted-color text-sm mt-0 mb-2">Hay registros con unidad solo numérica (ej. 500). No se corrigieron: la cantidad y las unidades por paquete no son la unidad de medida. {{ mensajeUnidad }}</p>
            <ul class="m-0 pl-5 text-sm">
                <li *ngFor="let u of unidadesInvalidas">{{ u.detalle }} · {{ u.nombre }} · «{{ u.unidad }}»</li>
            </ul>
        </div>
        <div class="card">
            <div class="flex flex-wrap items-end gap-3 mb-4">
                <div class="w-full lg:w-[18rem] min-w-0 lg:ml-auto">
                    <label class="block font-bold mb-1 text-sm">Buscar</label>
                    <app-tabla-busqueda placeholder="Buscar..." (buscar)="filtrarTabla(dt, $event)" />
                </div>
                <app-botones-exportar tipo="inventario" />
            </div>
            <p-table
                #dt
                [value]="cargando ? [] : productos"
                [loading]="cargando"
                [showLoader]="false"
                [paginator]="true"
                [alwaysShowPaginator]="true"
                [rows]="10"
                [rowsPerPageOptions]="filasTabla"
                [showCurrentPageReport]="true"
                currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} productos"
                [globalFilterFields]="['nombre', 'categoria.nombre', 'unidad_medida']"
                [rowHover]="true"
                sortMode="single"
                responsiveLayout="scroll"
            >
                <ng-template #header>
                    <tr><th></th><th>Producto</th><th>Categoría</th><th>Unidad</th><th>Stock</th><th>Mínimo</th><th>P. venta</th><th></th></tr>
                </ng-template>
                <ng-template #body let-p>
                    <tr>
                        <td><img [src]="foto(p.path_imagen)" alt="" class="w-10 h-10 rounded-border object-cover" /></td>
                        <td>{{ p.nombre }}</td>
                        <td>{{ p.categoria?.nombre || '-' }}</td>
                        <td [class.text-red-500]="unidadInvalida(p.unidad_medida)">{{ p.unidad_medida }}</td>
                        <td><p-tag [value]="p.stock" [severity]="p.bajo_minimo ? 'danger' : 'success'" /></td>
                        <td>{{ p.stock_minimo }}</td>
                        <td>{{ formatBs(p.precio_venta) }}</td>
                        <td>
                            <p-button
                                icon="pi pi-ellipsis-v"
                                [rounded]="true"
                                [text]="true"
                                severity="secondary"
                                pTooltip="Opciones"
                                tooltipPosition="left"
                                ariaLabel="Opciones del producto"
                                (onClick)="abrirAcciones($event, menuAcciones, p)"
                            />
                        </td>
                    </tr>
                </ng-template>
                <ng-template #loadingbody>
                    <tr *ngFor="let f of [0,1,2,3,4,5,6,7]" app-tabla-esqueleto [columnas]="8" [fila]="f" [conAvatar]="true"></tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr><td colspan="8"><div class="text-center py-8 text-muted-color">No hay productos.</div></td></tr>
                </ng-template>
            </p-table>
        </div>

        <p-dialog [header]="form.id ? 'Editar producto' : 'Nuevo producto'" [(visible)]="dialog" [modal]="true" [style]="{ width: '32rem' }" [breakpoints]="{ '960px': '95vw' }">
            <div class="flex flex-col gap-3">
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Imagen <app-ayuda-campo texto="Foto del producto. Opcional." posicion="right" /></label>
                    <app-imagen-campo tipo="producto" [path]="form.path_imagen" (pathChange)="form.path_imagen = $event" />
                </div>
                <div class="campo-form">
                    <label class="flex items-center gap-1 font-bold mb-2">Nombre <app-ayuda-campo texto="Ej.: Arroz pilado, Arroz en chala." posicion="right" /></label>
                    <p-iconfield iconPosition="right">
                        <input pInputText class="w-full" name="nombreProducto" [(ngModel)]="form.nombre" (blur)="tocadoNombre = true" [class.ng-dirty]="mostrarNombre" [class.ng-invalid]="!!errorNombre" [class.ng-valid]="okNombre" />
                        <p-inputicon [styleClass]="okNombre ? 'pi pi-check text-green-500' : errorNombre ? 'pi pi-times text-red-500' : ''" />
                    </p-iconfield>
                    <div class="campo-feedback-error" *ngIf="errorNombre">{{ errorNombre }}</div>
                    <div class="campo-feedback-ok" *ngIf="okNombre">Correcto</div>
                </div>
                <div class="campo-form">
                    <label class="flex items-center gap-1 font-bold mb-2">Categoría <app-ayuda-campo texto="Agrupa el producto (materia prima, terminado, etc.)." posicion="right" /></label>
                    <p-select [options]="categorias" optionLabel="nombre" optionValue="id" [(ngModel)]="form.id_categoria" placeholder="Elegí la categoría" [styleClass]="errorCategoria ? 'ng-dirty ng-invalid' : okCategoria ? 'ng-dirty ng-valid' : ''" fluid appendTo="body" [baseZIndex]="2100" (onChange)="tocadoCategoria = true" />
                    <div class="campo-feedback-error" *ngIf="errorCategoria">{{ errorCategoria }}</div>
                    <div class="campo-feedback-ok" *ngIf="okCategoria">Correcto</div>
                </div>
                <div class="campo-form">
                    <label class="block font-bold mb-1">Unidad de medida</label>
                    <p class="text-xs text-muted-color mt-0 mb-2">Kilo, Fanega, Quintal o Unidad. La cantidad va en otro campo.</p>
                    <p-select [options]="unidades" optionLabel="label" optionValue="value" [(ngModel)]="form.unidad_medida" placeholder="Elegí la unidad" [styleClass]="okUnidad ? 'ng-dirty ng-valid' : errorUnidad ? 'ng-dirty ng-invalid' : ''" fluid appendTo="body" [baseZIndex]="2100" (onChange)="tocadoUnidad = true" />
                    <div class="campo-feedback-error" *ngIf="errorUnidad">{{ errorUnidad }}</div>
                    <div class="campo-feedback-ok" *ngIf="okUnidad">Correcto</div>
                </div>
                <div><label class="flex items-center gap-1 font-bold mb-2">Precio venta <app-ayuda-campo texto="Precio sugerido al vender. Se puede cambiar en cada venta." posicion="right" /></label><app-input-numero [(ngModel)]="form.precio_venta" /></div>
                <div><label class="flex items-center gap-1 font-bold mb-2">Precio compra <app-ayuda-campo texto="Costo de referencia. Se puede cambiar en cada compra." posicion="right" /></label><app-input-numero [(ngModel)]="form.precio_compra" /></div>
                <div *ngIf="!form.id"><label class="flex items-center gap-1 font-bold mb-2">Stock inicial <app-ayuda-campo texto="Cantidad con la que arranca el inventario. Solo al crear." posicion="right" /></label><app-input-numero tipo="cantidad" [(ngModel)]="form.stock" [min]="0" /></div>
                <div><label class="flex items-center gap-1 font-bold mb-2">Stock mínimo <app-ayuda-campo texto="Alerta cuando el stock baje de este valor." posicion="right" /></label><app-input-numero tipo="cantidad" [(ngModel)]="form.stock_minimo" [min]="0" /></div>
                <div><label class="flex items-center gap-1 font-bold mb-2">Descripción <app-ayuda-campo texto="Detalle interno del producto." posicion="top" /></label><textarea pTextarea class="w-full" rows="2" [(ngModel)]="form.descripcion"></textarea></div>
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="dialog = false" />
                <p-button label="Guardar" [loading]="guardando" (onClick)="guardar()" />
            </ng-template>
        </p-dialog>

        <p-dialog header="Ajuste de stock" [(visible)]="dialogAjuste" [modal]="true" [style]="{ width: '28rem' }" [breakpoints]="{ '960px': '95vw' }">
            <p class="mb-3" *ngIf="ajusteProducto">{{ ajusteProducto.nombre }} · stock {{ ajusteProducto.stock }}</p>
            <label class="flex items-center gap-1 font-bold mb-2">Cantidad (+ entra / − sale) <app-ayuda-campo texto="Positivo entra al almacén. Negativo sale (merma, ajuste). No uses esto para ventas o compras." posicion="right" /></label>
            <app-input-numero tipo="cantidad" [(ngModel)]="ajusteCantidad" />
            <label class="flex items-center gap-1 font-bold mb-2 mt-3">Observación <app-ayuda-campo texto="Motivo del ajuste. Ej.: merma, conteo físico." posicion="top" /></label>
            <textarea pTextarea class="w-full" rows="2" [(ngModel)]="ajusteObs"></textarea>
            <ng-template #footer>
                <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="dialogAjuste = false" />
                <p-button label="Aplicar" [loading]="guardando" (onClick)="ajustar()" />
            </ng-template>
        </p-dialog>

        <p-dialog header="Kardex" [(visible)]="dialogKardex" [modal]="true" [style]="{ width: '48rem' }" [breakpoints]="{ '960px': '95vw' }">
            <p-table
                [value]="kardex"
                [paginator]="true"
                [rows]="8"
                [rowsPerPageOptions]="filasTabla"
                [showCurrentPageReport]="true"
                currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} movimientos"
                [rowHover]="true"
                responsiveLayout="scroll"
            >
                <ng-template #header><tr><th>Fecha</th><th>Tipo</th><th>Cant.</th><th>Stock</th><th>Origen</th></tr></ng-template>
                <ng-template #body let-k>
                    <tr><td>{{ k.fecha | date:'short' }}</td><td>{{ k.tipo }}</td><td>{{ k.cantidad }}</td><td>{{ k.stock_resultante }}</td><td>{{ k.origen }}</td></tr>
                </ng-template>
            </p-table>
        </p-dialog>
    `
})
export class InventarioPage implements OnInit {
    filasTabla = FILAS_TABLA;
    filtrarTabla = filtrarTabla;
    productos: any[] = [];
    categorias: any[] = [];
    kardex: any[] = [];
    cargando = false;
    guardando = false;
    dialog = false;
    dialogAjuste = false;
    dialogKardex = false;
    form: any = this.vacio();
    ajusteProducto: any = null;
    ajusteCantidad = 0;
    ajusteObs = '';
    itemsAcciones: MenuItem[] = [];
    formatBs = formatBs;
    unidadesInvalidas: { origen: string; id: number; nombre: string; unidad: string; detalle: string }[] = [];
    mensajeUnidad = MENSAJE_UNIDAD_MEDIDA;
    unidades = UNIDADES_MEDIDA;
    enviado = false;
    tocadoNombre = false;
    tocadoCategoria = false;
    tocadoUnidad = false;

    constructor(private http: HttpClient, private aviso: AvisoService, private productosService: ProductosService, private router: Router) {}

    ngOnInit(): void {
        this.http.get<any[]>(apiUrl('/api/productos/categorias')).subscribe({ next: (d) => (this.categorias = d) });
        this.cargar();
        this.cargarUnidadesInvalidas();
    }

    cargar(): void {
        this.cargando = true;
        this.http.get<any[]>(apiUrl('/api/productos')).subscribe({
            next: (d) => { this.productos = d; this.cargando = false; },
            error: (e) => { this.cargando = false; this.aviso.error(e, 'No se pudo cargar inventario'); }
        });
    }

    get mostrarNombre(): boolean {
        return this.enviado || this.tocadoNombre;
    }

    get mostrarCategoria(): boolean {
        return this.enviado || this.tocadoCategoria;
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

    get errorCategoria(): string | null {
        if (!this.mostrarCategoria) {
            return null;
        }
        return this.form.id_categoria ? null : 'Elegí una categoría.';
    }

    get okCategoria(): boolean {
        return this.mostrarCategoria && !this.errorCategoria;
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

    abrirNuevo(): void {
        this.form = this.vacio();
        this.enviado = false;
        this.tocadoNombre = false;
        this.tocadoCategoria = false;
        this.tocadoUnidad = false;
        this.dialog = true;
    }

    abrirAcciones(event: Event, menu: Menu, p: any): void {
        this.itemsAcciones = [
            {
                label: 'Editar',
                icon: 'pi pi-pencil menu-icon-editar',
                iconStyle: { color: '#f59e0b' },
                command: () => this.editar(p)
            },
            esProductoEmpaque(p)
                ? {
                    label: 'Comprar bolsas',
                    icon: 'pi pi-shopping-cart menu-icon-ajuste',
                    iconStyle: { color: '#06b6d4' },
                    command: () => this.router.navigate([APP_ROUTES.compras], {
                        queryParams: { nueva: 1, tipo: 'BOLSAS', producto: p.id }
                    })
                }
                : {
                    label: 'Ajustar stock',
                    icon: 'pi pi-sliders-h menu-icon-ajuste',
                    iconStyle: { color: '#06b6d4' },
                    command: () => this.abrirAjuste(p)
                },
            {
                label: 'Ver kardex',
                icon: 'pi pi-list menu-icon-kardex',
                iconStyle: { color: '#8b5cf6' },
                command: () => this.verKardex(p)
            }
        ];
        menu.toggle(event);
    }

    editar(p: any): void {
        this.form = { ...p, unidad_medida: normalizarUnidadMedida(p.unidad_medida) || 'Kilo' };
        this.enviado = false;
        this.tocadoNombre = false;
        this.tocadoCategoria = false;
        this.tocadoUnidad = false;
        this.dialog = true;
    }

    guardar(): void {
        this.enviado = true;
        if (this.errorNombre || this.errorCategoria || this.errorUnidad) {
            return;
        }
        this.guardando = true;
        const payload = {
            nombre: this.form.nombre,
            descripcion: this.form.descripcion || '',
            precio_venta: this.form.precio_venta || 0,
            precio_compra: this.form.precio_compra || 0,
            stock: this.form.stock || 0,
            stock_minimo: this.form.stock_minimo || 0,
            unidad_medida: this.form.unidad_medida || 'Kilo',
            path_imagen: this.form.path_imagen || imagenDefault('producto'),
            id_categoria: this.form.id_categoria || undefined
        };
        const req = this.form.id
            ? this.http.put<{ mensaje: string }>(apiUrl(`/api/productos/${this.form.id}`), payload)
            : this.http.post<{ mensaje: string }>(apiUrl('/api/productos'), payload);
        req.subscribe({
            next: (res) => { this.guardando = false; this.dialog = false; this.aviso.ok('Listo', res.mensaje); this.cargar(); this.cargarUnidadesInvalidas(); },
            error: (e) => { this.guardando = false; this.aviso.error(e, 'No se pudo guardar'); }
        });
    }

    abrirAjuste(p: any): void {
        this.ajusteProducto = p;
        this.ajusteCantidad = 0;
        this.ajusteObs = '';
        this.dialogAjuste = true;
    }

    ajustar(): void {
        if (!this.ajusteProducto) return;
        this.guardando = true;
        this.http.post<{ mensaje: string }>(apiUrl(`/api/productos/${this.ajusteProducto.id}/ajuste`), {
            cantidad: this.ajusteCantidad,
            observacion: this.ajusteObs || undefined
        }).subscribe({
            next: (res) => { this.guardando = false; this.dialogAjuste = false; this.aviso.ok('Listo', res.mensaje); this.cargar(); },
            error: (e) => { this.guardando = false; this.aviso.error(e, 'No se pudo ajustar'); }
        });
    }

    verKardex(p: any): void {
        this.http.get<any[]>(apiUrl(`/api/productos/kardex/${p.id}`)).subscribe({
            next: (d) => { this.kardex = d; this.dialogKardex = true; },
            error: (e) => this.aviso.error(e, 'No se pudo cargar kardex')
        });
    }

    private vacio() {
        return { id: 0, nombre: '', descripcion: '', precio_venta: 0, precio_compra: 0, stock: 0, stock_minimo: 0, unidad_medida: 'Kilo', id_categoria: null, path_imagen: imagenDefault('producto') };
    }

    unidadInvalida(valor: string): boolean {
        return Boolean(valor) && !esUnidadMedidaValida(valor);
    }

    foto(path: string): string {
        return mediaUrl(path, 'producto');
    }

    private cargarUnidadesInvalidas(): void {
        this.productosService.unidadesInvalidas().subscribe({
            next: (res) => {
                this.unidadesInvalidas = res.data || [];
            }
        });
    }
}
