import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AvisoService } from '../../shared/services/aviso.service';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { Proveedor } from './compras.models';
import { ProveedoresService } from './compras.service';
import { ImagenCampoComponent } from '../../shared/components/imagen-campo';
import { TablaEsqueletoComponent } from '../../shared/components/tabla-esqueleto';
import { AyudaCampoComponent } from '../../shared/components/ayuda-campo';
import { TooltipModule } from 'primeng/tooltip';
import { imagenDefault, mediaUrl } from '../../core/utils/media-url';

@Component({
    selector: 'app-proveedores',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        DialogModule,
        InputTextModule,
        TableModule,
        TagModule,
        TextareaModule,
        ToggleSwitchModule,
        ImagenCampoComponent,
        TablaEsqueletoComponent,
        AyudaCampoComponent,
        TooltipModule
    ],
    template: `
        <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
                <div class="text-surface-900 dark:text-surface-0 font-semibold text-2xl mb-1">Proveedores</div>
                <div class="text-muted-color">Quienes venden arroz en chala, insumos y servicios</div>
            </div>
            <p-button label="Nuevo proveedor" icon="pi pi-plus" (onClick)="abrirNuevo()" />
        </div>

        <div class="card">
            <div class="flex flex-wrap gap-3 mb-4">
                <input pInputText [(ngModel)]="busqueda" placeholder="Buscar por nombre o NIT/CI" class="w-full md:w-80" (keyup.enter)="cargar()" />
                <p-button label="Buscar" icon="pi pi-search" (onClick)="cargar()" [loading]="cargando" />
            </div>
            <p-table [value]="cargando ? [] : proveedores" [loading]="cargando" [showLoader]="false" [paginator]="true" [rows]="10" responsiveLayout="scroll">
                <ng-template #header>
                    <tr>
                        <th></th>
                        <th>Nombre</th>
                        <th>NIT / CI</th>
                        <th>Teléfono</th>
                        <th>Dirección</th>
                        <th>Estado</th>
                        <th></th>
                    </tr>
                </ng-template>
                <ng-template #body let-item>
                    <tr>
                        <td><img [src]="foto(item.path_imagen)" alt="" class="w-10 h-10 rounded-border object-cover" /></td>
                        <td>{{ item.nombre }}</td>
                        <td>{{ item.nit_ci || '-' }}</td>
                        <td>{{ item.telefono || '-' }}</td>
                        <td>{{ item.direccion || '-' }}</td>
                        <td><p-tag [value]="item.activo ? 'Activo' : 'Inactivo'" [severity]="item.activo ? 'success' : 'secondary'" /></td>
                        <td><p-button icon="pi pi-pencil" [rounded]="true" [outlined]="true" severity="warn" pTooltip="Editar" tooltipPosition="left" (onClick)="editar(item)" /></td>
                    </tr>
                </ng-template>
                <ng-template #loadingbody>
                    <tr *ngFor="let f of [0,1,2,3,4,5,6,7]" app-tabla-esqueleto [columnas]="7" [fila]="f" [conAvatar]="true"></tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr>
                        <td colspan="7">
                            <div class="text-center py-8 text-muted-color">
                                <i class="pi pi-truck text-4xl mb-3 block"></i>
                                No hay proveedores registrados.
                            </div>
                        </td>
                    </tr>
                </ng-template>
            </p-table>
        </div>

        <p-dialog [header]="form.id ? 'Editar proveedor' : 'Nuevo proveedor'" [(visible)]="dialog" [modal]="true" [style]="{ width: '32rem' }" [breakpoints]="{ '960px': '95vw' }">
            <div class="flex flex-col gap-4">
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Imagen <app-ayuda-campo texto="Logo o foto del proveedor. Opcional." posicion="right" /></label>
                    <app-imagen-campo tipo="proveedor" [path]="form.path_imagen" (pathChange)="form.path_imagen = $event" />
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Nombre <app-ayuda-campo texto="Nombre comercial. Ej.: Cooperativa Norte." posicion="right" /></label>
                    <input pInputText class="w-full" [(ngModel)]="form.nombre" />
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">NIT / CI <app-ayuda-campo texto="Documento fiscal. Puede dejarse vacío." posicion="right" /></label>
                    <input pInputText class="w-full" [(ngModel)]="form.nit_ci" />
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Teléfono <app-ayuda-campo texto="Para coordinar acopio o pagos. Opcional." posicion="right" /></label>
                    <input pInputText class="w-full" [(ngModel)]="form.telefono" />
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Dirección <app-ayuda-campo texto="Dónde recoger o entregar. Opcional." posicion="right" /></label>
                    <input pInputText class="w-full" [(ngModel)]="form.direccion" />
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Observación <app-ayuda-campo texto="Nota interna: condiciones, zona, etc." posicion="top" /></label>
                    <textarea pTextarea class="w-full" rows="2" [(ngModel)]="form.observacion"></textarea>
                </div>
                <div class="flex items-center gap-2" *ngIf="form.id">
                    <p-toggleswitch [(ngModel)]="form.activo" />
                    <span>Activo</span>
                </div>
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="dialog = false" />
                <p-button label="Guardar" [loading]="guardando" (onClick)="guardar()" />
            </ng-template>
        </p-dialog>
    `
})
export class ProveedoresPage implements OnInit {
    proveedores: Proveedor[] = [];
    cargando = false;
    guardando = false;
    dialog = false;
    busqueda = '';
    form: Proveedor = this.vacio();

    constructor(private proveedoresService: ProveedoresService, private aviso: AvisoService) {}

    ngOnInit(): void {
        this.cargar();
    }

    cargar(): void {
        this.cargando = true;
        this.proveedoresService.listar({ q: this.busqueda || undefined, activos: 'todos' }).subscribe({
            next: (data) => {
                this.proveedores = data;
                this.cargando = false;
            },
            error: (err) => {
                this.cargando = false;
                this.aviso.error(err, 'No se pudo cargar proveedores');
            }
        });
    }

    abrirNuevo(): void {
        this.form = this.vacio();
        this.dialog = true;
    }

    editar(item: Proveedor): void {
        this.form = { ...item };
        this.dialog = true;
    }

    guardar(): void {
        if (!this.form.nombre?.trim()) {
            this.aviso.aviso('Validación', 'El nombre es obligatorio');
            return;
        }
        this.guardando = true;
        const payload = {
            nombre: this.form.nombre,
            nit_ci: this.form.nit_ci || '',
            telefono: this.form.telefono || '',
            direccion: this.form.direccion || '',
            observacion: this.form.observacion || '',
            activo: this.form.activo,
            path_imagen: this.form.path_imagen || imagenDefault('proveedor')
        };
        const req = this.form.id
            ? this.proveedoresService.actualizar(this.form.id, payload)
            : this.proveedoresService.crear(payload);
        req.subscribe({
            next: (res) => {
                this.guardando = false;
                this.dialog = false;
                this.aviso.ok('Listo', res.mensaje);
                this.cargar();
            },
            error: (err) => {
                this.guardando = false;
                this.aviso.error(err, 'No se pudo guardar');
            }
        });
    }

    private vacio(): Proveedor {
        return { id: 0, nombre: '', nit_ci: '', telefono: '', direccion: '', observacion: '', activo: true, path_imagen: imagenDefault('proveedor') };
    }

    foto(path?: string | null): string {
        return mediaUrl(path, 'proveedor');
    }
}
