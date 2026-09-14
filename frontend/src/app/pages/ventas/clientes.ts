import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { Cliente } from './ventas.models';
import { ClientesService } from './ventas.service';
import { ImagenCampoComponent } from '../../shared/components/imagen-campo';
import { imagenDefault, mediaUrl } from '../../core/utils/media-url';

@Component({
    selector: 'app-clientes',
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
        ToastModule,
        ToggleSwitchModule,
        ImagenCampoComponent
    ],
    providers: [MessageService],
    template: `
        <p-toast />
        <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
                <div class="text-surface-900 dark:text-surface-0 font-semibold text-2xl mb-1">Clientes</div>
                <div class="text-muted-color">Compradores de arroz y otros productos</div>
            </div>
            <p-button label="Nuevo cliente" icon="pi pi-plus" (onClick)="abrirNuevo()" />
        </div>

        <div class="card">
            <div class="flex flex-wrap gap-3 mb-4">
                <input pInputText [(ngModel)]="busqueda" placeholder="Buscar por nombre o NIT/CI" class="w-full md:w-80" (keyup.enter)="cargar()" />
                <p-button label="Buscar" icon="pi pi-search" (onClick)="cargar()" [loading]="cargando" />
            </div>
            <p-table [value]="clientes" [loading]="cargando" [paginator]="true" [rows]="10" responsiveLayout="scroll">
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
                <ng-template #body let-cli>
                    <tr>
                        <td><img [src]="foto(cli.path_imagen)" alt="" class="w-10 h-10 rounded-border object-cover" /></td>
                        <td>{{ cli.nombre }}</td>
                        <td>{{ cli.nit_ci || '-' }}</td>
                        <td>{{ cli.telefono || '-' }}</td>
                        <td>{{ cli.direccion || '-' }}</td>
                        <td><p-tag [value]="cli.activo ? 'Activo' : 'Inactivo'" [severity]="cli.activo ? 'success' : 'secondary'" /></td>
                        <td><p-button icon="pi pi-pencil" [rounded]="true" [outlined]="true" (onClick)="editar(cli)" /></td>
                    </tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr>
                        <td colspan="7">
                            <div class="text-center py-8 text-muted-color">
                                <i class="pi pi-users text-4xl mb-3 block"></i>
                                No hay clientes registrados.
                            </div>
                        </td>
                    </tr>
                </ng-template>
            </p-table>
        </div>

        <p-dialog [header]="form.id ? 'Editar cliente' : 'Nuevo cliente'" [(visible)]="dialog" [modal]="true" [style]="{ width: '32rem' }" [breakpoints]="{ '960px': '95vw' }">
            <div class="flex flex-col gap-4">
                <div>
                    <label class="block font-bold mb-2">Imagen</label>
                    <app-imagen-campo tipo="cliente" [path]="form.path_imagen" (pathChange)="form.path_imagen = $event" />
                </div>
                <div>
                    <label class="block font-bold mb-2">Nombre</label>
                    <input pInputText class="w-full" [(ngModel)]="form.nombre" />
                </div>
                <div>
                    <label class="block font-bold mb-2">NIT / CI</label>
                    <input pInputText class="w-full" [(ngModel)]="form.nit_ci" />
                </div>
                <div>
                    <label class="block font-bold mb-2">Teléfono</label>
                    <input pInputText class="w-full" [(ngModel)]="form.telefono" />
                </div>
                <div>
                    <label class="block font-bold mb-2">Dirección</label>
                    <input pInputText class="w-full" [(ngModel)]="form.direccion" />
                </div>
                <div>
                    <label class="block font-bold mb-2">Observación</label>
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
export class ClientesPage implements OnInit {
    clientes: Cliente[] = [];
    cargando = false;
    guardando = false;
    dialog = false;
    busqueda = '';
    form: Cliente = this.vacio();

    constructor(private clientesService: ClientesService, private messageService: MessageService) {}

    ngOnInit(): void {
        this.cargar();
    }

    cargar(): void {
        this.cargando = true;
        this.clientesService.listar({ q: this.busqueda || undefined, activos: 'todos' }).subscribe({
            next: (data) => {
                this.clientes = data;
                this.cargando = false;
            },
            error: (err) => {
                this.cargando = false;
                this.messageService.add({ severity: 'error', summary: 'Error', detail: this.msg(err, 'No se pudo cargar clientes') });
            }
        });
    }

    abrirNuevo(): void {
        this.form = this.vacio();
        this.dialog = true;
    }

    editar(cli: Cliente): void {
        this.form = { ...cli };
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
            nit_ci: this.form.nit_ci,
            telefono: this.form.telefono,
            direccion: this.form.direccion,
            observacion: this.form.observacion,
            activo: this.form.activo,
            path_imagen: this.form.path_imagen || imagenDefault('cliente')
        };
        const req = this.form.id
            ? this.clientesService.actualizar(this.form.id, payload)
            : this.clientesService.crear(payload);
        req.subscribe({
            next: (res) => {
                this.guardando = false;
                this.dialog = false;
                this.messageService.add({ severity: 'success', summary: 'Listo', detail: res.mensaje });
                this.cargar();
            },
            error: (err) => {
                this.guardando = false;
                this.messageService.add({ severity: 'error', summary: 'Error', detail: this.msg(err, 'No se pudo guardar') });
            }
        });
    }

    private vacio(): Cliente {
        return { id: 0, nombre: '', nit_ci: '', telefono: '', direccion: '', observacion: '', activo: true, path_imagen: imagenDefault('cliente') };
    }

    foto(path?: string | null): string {
        return mediaUrl(path, 'cliente');
    }

    private msg(err: HttpErrorResponse, fallback: string): string {
        return err?.error?.mensaje || fallback;
    }
}
