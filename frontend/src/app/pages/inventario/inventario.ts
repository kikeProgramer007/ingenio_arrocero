import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { apiUrl } from '../../core/utils/api-url';
import { imagenDefault, mediaUrl } from '../../core/utils/media-url';
import { formatBs } from '../caja/caja.utils';
import { ImagenCampoComponent } from '../../shared/components/imagen-campo';

@Component({
    selector: 'app-inventario',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, DialogModule, InputNumberModule, InputTextModule, SelectModule, TableModule, TagModule, TextareaModule, ToastModule, ImagenCampoComponent],
    providers: [MessageService],
    template: `
        <p-toast />
        <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
                <div class="text-surface-900 dark:text-surface-0 font-semibold text-2xl mb-1">Inventario</div>
                <div class="text-muted-color">Productos, stock mínimo y ajustes</div>
            </div>
            <p-button label="Nuevo producto" icon="pi pi-plus" (onClick)="abrirNuevo()" />
        </div>
        <div class="card">
            <p-table [value]="productos" [loading]="cargando" [paginator]="true" [rows]="10" responsiveLayout="scroll">
                <ng-template #header>
                    <tr><th></th><th>Producto</th><th>Categoría</th><th>Unidad</th><th>Stock</th><th>Mínimo</th><th>P. venta</th><th></th></tr>
                </ng-template>
                <ng-template #body let-p>
                    <tr>
                        <td><img [src]="foto(p.path_imagen)" alt="" class="w-10 h-10 rounded-border object-cover" /></td>
                        <td>{{ p.nombre }}</td>
                        <td>{{ p.categoria?.nombre || '-' }}</td>
                        <td>{{ p.unidad_medida }}</td>
                        <td><p-tag [value]="p.stock" [severity]="p.bajo_minimo ? 'danger' : 'success'" /></td>
                        <td>{{ p.stock_minimo }}</td>
                        <td>{{ formatBs(p.precio_venta) }}</td>
                        <td class="flex gap-1">
                            <p-button icon="pi pi-pencil" [rounded]="true" [outlined]="true" (onClick)="editar(p)" />
                            <p-button icon="pi pi-sliders-h" [rounded]="true" [outlined]="true" (onClick)="abrirAjuste(p)" />
                            <p-button icon="pi pi-list" [rounded]="true" [outlined]="true" (onClick)="verKardex(p)" />
                        </td>
                    </tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr><td colspan="8"><div class="text-center py-8 text-muted-color">No hay productos.</div></td></tr>
                </ng-template>
            </p-table>
        </div>

        <p-dialog [header]="form.id ? 'Editar producto' : 'Nuevo producto'" [(visible)]="dialog" [modal]="true" [style]="{ width: '32rem' }">
            <div class="flex flex-col gap-3">
                <div>
                    <label class="block font-bold mb-2">Imagen</label>
                    <app-imagen-campo tipo="producto" [path]="form.path_imagen" (pathChange)="form.path_imagen = $event" />
                </div>
                <div><label class="block font-bold mb-2">Nombre</label><input pInputText class="w-full" [(ngModel)]="form.nombre" /></div>
                <div><label class="block font-bold mb-2">Categoría</label><p-select [options]="categorias" optionLabel="nombre" optionValue="id" [(ngModel)]="form.id_categoria" fluid /></div>
                <div><label class="block font-bold mb-2">Unidad</label><input pInputText class="w-full" [(ngModel)]="form.unidad_medida" /></div>
                <div><label class="block font-bold mb-2">Precio venta</label><p-inputNumber [(ngModel)]="form.precio_venta" mode="decimal" [min]="0" prefix="Bs " fluid /></div>
                <div><label class="block font-bold mb-2">Precio compra</label><p-inputNumber [(ngModel)]="form.precio_compra" mode="decimal" [min]="0" prefix="Bs " fluid /></div>
                <div *ngIf="!form.id"><label class="block font-bold mb-2">Stock inicial</label><p-inputNumber [(ngModel)]="form.stock" [min]="0" [maxFractionDigits]="3" fluid /></div>
                <div><label class="block font-bold mb-2">Stock mínimo</label><p-inputNumber [(ngModel)]="form.stock_minimo" [min]="0" [maxFractionDigits]="3" fluid /></div>
                <div><label class="block font-bold mb-2">Descripción</label><textarea pTextarea class="w-full" rows="2" [(ngModel)]="form.descripcion"></textarea></div>
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="dialog = false" />
                <p-button label="Guardar" [loading]="guardando" (onClick)="guardar()" />
            </ng-template>
        </p-dialog>

        <p-dialog header="Ajuste de stock" [(visible)]="dialogAjuste" [modal]="true" [style]="{ width: '28rem' }">
            <p class="mb-3" *ngIf="ajusteProducto">{{ ajusteProducto.nombre }} · stock {{ ajusteProducto.stock }}</p>
            <label class="block font-bold mb-2">Cantidad (+ entra / − sale)</label>
            <p-inputNumber [(ngModel)]="ajusteCantidad" [maxFractionDigits]="3" fluid />
            <label class="block font-bold mb-2 mt-3">Observación</label>
            <textarea pTextarea class="w-full" rows="2" [(ngModel)]="ajusteObs"></textarea>
            <ng-template #footer>
                <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="dialogAjuste = false" />
                <p-button label="Aplicar" [loading]="guardando" (onClick)="ajustar()" />
            </ng-template>
        </p-dialog>

        <p-dialog header="Kardex" [(visible)]="dialogKardex" [modal]="true" [style]="{ width: '48rem' }">
            <p-table [value]="kardex" [paginator]="true" [rows]="8">
                <ng-template #header><tr><th>Fecha</th><th>Tipo</th><th>Cant.</th><th>Stock</th><th>Origen</th></tr></ng-template>
                <ng-template #body let-k>
                    <tr><td>{{ k.fecha | date:'short' }}</td><td>{{ k.tipo }}</td><td>{{ k.cantidad }}</td><td>{{ k.stock_resultante }}</td><td>{{ k.origen }}</td></tr>
                </ng-template>
            </p-table>
        </p-dialog>
    `
})
export class InventarioPage implements OnInit {
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
    formatBs = formatBs;

    constructor(private http: HttpClient, private messageService: MessageService) {}

    ngOnInit(): void {
        this.http.get<any[]>(apiUrl('/api/productos/categorias')).subscribe({ next: (d) => (this.categorias = d) });
        this.cargar();
    }

    cargar(): void {
        this.cargando = true;
        this.http.get<any[]>(apiUrl('/api/productos')).subscribe({
            next: (d) => { this.productos = d; this.cargando = false; },
            error: (e) => { this.cargando = false; this.err(e, 'No se pudo cargar inventario'); }
        });
    }

    abrirNuevo(): void {
        this.form = this.vacio();
        this.dialog = true;
    }

    editar(p: any): void {
        this.form = { ...p };
        this.dialog = true;
    }

    guardar(): void {
        if (!this.form.nombre?.trim()) {
            this.messageService.add({ severity: 'warn', summary: 'Validación', detail: 'El nombre es obligatorio' });
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
            unidad_medida: this.form.unidad_medida || 'kg',
            path_imagen: this.form.path_imagen || imagenDefault('producto'),
            id_categoria: this.form.id_categoria || undefined
        };
        const req = this.form.id
            ? this.http.put<{ mensaje: string }>(apiUrl(`/api/productos/${this.form.id}`), payload)
            : this.http.post<{ mensaje: string }>(apiUrl('/api/productos'), payload);
        req.subscribe({
            next: (res) => { this.guardando = false; this.dialog = false; this.messageService.add({ severity: 'success', summary: 'Listo', detail: res.mensaje }); this.cargar(); },
            error: (e) => { this.guardando = false; this.err(e, 'No se pudo guardar'); }
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
            next: (res) => { this.guardando = false; this.dialogAjuste = false; this.messageService.add({ severity: 'success', summary: 'Listo', detail: res.mensaje }); this.cargar(); },
            error: (e) => { this.guardando = false; this.err(e, 'No se pudo ajustar'); }
        });
    }

    verKardex(p: any): void {
        this.http.get<any[]>(apiUrl(`/api/productos/kardex/${p.id}`)).subscribe({
            next: (d) => { this.kardex = d; this.dialogKardex = true; },
            error: (e) => this.err(e, 'No se pudo cargar kardex')
        });
    }

    private vacio() {
        return { id: 0, nombre: '', descripcion: '', precio_venta: 0, precio_compra: 0, stock: 0, stock_minimo: 0, unidad_medida: 'kg', id_categoria: null, path_imagen: imagenDefault('producto') };
    }

    foto(path: string): string {
        return mediaUrl(path, 'producto');
    }

    private err(e: HttpErrorResponse, fallback: string) {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: e?.error?.mensaje || e?.error?.errores?.[0] || fallback });
    }
}
