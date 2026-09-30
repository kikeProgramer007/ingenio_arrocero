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
import { forkJoin } from 'rxjs';
import { Cliente, Cobranza, Venta } from './ventas.models';
import { ImagenCampoComponent } from '../../shared/components/imagen-campo';
import { TablaEsqueletoComponent } from '../../shared/components/tabla-esqueleto';
import { AyudaCampoComponent } from '../../shared/components/ayuda-campo';
import { TooltipModule } from 'primeng/tooltip';
import { Menu, MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { imagenDefault, mediaUrl } from '../../core/utils/media-url';
import { etiquetaPago, formatBs, formatFecha } from '../caja/caja.utils';
import { ClientesService, VentasService } from './ventas.service';
import { TablaBusquedaComponent } from '../../shared/components/tabla-busqueda';
import { FILAS_TABLA, filtrarTabla } from '../../shared/utils/tabla';

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
        ToggleSwitchModule,
        ImagenCampoComponent,
        TablaEsqueletoComponent,
        AyudaCampoComponent,
        TooltipModule,
        MenuModule,
        TablaBusquedaComponent
    ],
    template: `
        <p-menu #menuAcciones [popup]="true" [model]="itemsAcciones" [appendTo]="'body'" [baseZIndex]="1200" />
        <div class="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div class="min-w-0">
                <div class="text-surface-900 dark:text-surface-0 font-semibold text-2xl mb-1">Clientes</div>
                <div class="text-muted-color">Compradores de arroz y otros productos</div>
            </div>
            <p-button label="Nuevo cliente" icon="pi pi-plus" (onClick)="abrirNuevo()" />
        </div>

        <div class="card">
            <p-table
                #dt
                [value]="cargando ? [] : clientes"
                [loading]="cargando"
                [showLoader]="false"
                [paginator]="true"
                [rows]="10"
                [rowsPerPageOptions]="filasTabla"
                [showCurrentPageReport]="true"
                currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} clientes"
                [globalFilterFields]="['nombre', 'nit_ci', 'telefono', 'direccion']"
                [rowHover]="true"
                responsiveLayout="scroll"
            >
                <ng-template #caption>
                    <div class="flex flex-wrap items-center justify-between gap-3">
                        <span class="font-semibold">Listado de clientes</span>
                        <app-tabla-busqueda placeholder="Buscar por nombre o NIT/CI" (buscar)="filtrarTabla(dt, $event)" />
                    </div>
                </ng-template>
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
                        <td>
                            <p-button
                                icon="pi pi-ellipsis-v"
                                [rounded]="true"
                                [text]="true"
                                severity="secondary"
                                pTooltip="Opciones"
                                tooltipPosition="left"
                                ariaLabel="Opciones del cliente"
                                (onClick)="abrirAcciones($event, menuAcciones, cli)"
                            />
                        </td>
                    </tr>
                </ng-template>
                <ng-template #loadingbody>
                    <tr *ngFor="let f of [0,1,2,3,4,5,6,7]" app-tabla-esqueleto [columnas]="7" [fila]="f" [conAvatar]="true"></tr>
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
                    <label class="flex items-center gap-1 font-bold mb-2">Imagen <app-ayuda-campo texto="Foto o logo del cliente. Opcional." posicion="right" /></label>
                    <app-imagen-campo tipo="cliente" [path]="form.path_imagen" (pathChange)="form.path_imagen = $event" />
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Nombre <app-ayuda-campo texto="Nombre comercial o de la persona. Ej.: Hotel El Granero." posicion="right" /></label>
                    <input pInputText class="w-full" [(ngModel)]="form.nombre" />
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">NIT / CI <app-ayuda-campo texto="Documento para la nota de venta. Puede dejarse vacío." posicion="right" /></label>
                    <input pInputText class="w-full" [(ngModel)]="form.nit_ci" />
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Teléfono <app-ayuda-campo texto="Para contactarlo al cobrar. Opcional." posicion="right" /></label>
                    <input pInputText class="w-full" [(ngModel)]="form.telefono" />
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Dirección <app-ayuda-campo texto="Dónde entregar o visitar. Opcional." posicion="right" /></label>
                    <input pInputText class="w-full" [(ngModel)]="form.direccion" />
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Observación <app-ayuda-campo texto="Nota interna: horarios, crédito habitual, etc." posicion="top" /></label>
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

        <p-dialog header="Cuenta de {{ extractoCliente?.nombre }}" [(visible)]="dialogExtracto" [modal]="true" [style]="{ width: '52rem' }" [breakpoints]="{ '960px': '95vw' }">
            <div class="grid grid-cols-12 gap-3 mb-4">
                <div class="col-span-4">
                    <div class="text-muted-color">Ventas</div>
                    <div class="font-semibold text-xl">{{ formatBs(extractoTotal) }}</div>
                </div>
                <div class="col-span-4">
                    <div class="text-muted-color">Cobrado</div>
                    <div class="font-semibold text-xl text-green-600">{{ formatBs(extractoCobrado) }}</div>
                </div>
                <div class="col-span-4">
                    <div class="text-muted-color">Por cobrar</div>
                    <div class="font-semibold text-xl text-orange-500">{{ formatBs(extractoPendiente) }}</div>
                </div>
            </div>
            <div class="font-semibold mb-2">Ventas</div>
            <p-table [value]="extractoVentas" [paginator]="true" [rows]="6" responsiveLayout="scroll">
                <ng-template #header>
                    <tr><th>#</th><th>Fecha</th><th>Total</th><th>Cobrado</th><th>Pendiente</th><th>Estado</th></tr>
                </ng-template>
                <ng-template #body let-v>
                    <tr>
                        <td>{{ v.id }}</td>
                        <td>{{ formatFecha(v.fecha) }}</td>
                        <td>{{ formatBs(v.total) }}</td>
                        <td>{{ formatBs(v.pagado) }}</td>
                        <td>{{ formatBs(v.saldo_pendiente) }}</td>
                        <td><p-tag [value]="v.estado" [severity]="v.estado === 'PAGADA' ? 'success' : v.estado === 'PARCIAL' ? 'info' : v.estado === 'PENDIENTE' ? 'warn' : 'secondary'" /></td>
                    </tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr><td colspan="6"><div class="text-center py-4 text-muted-color">Sin ventas.</div></td></tr>
                </ng-template>
            </p-table>
            <div class="font-semibold mt-4 mb-2">Cobranzas</div>
            <p-table [value]="extractoCobranzas" [paginator]="true" [rows]="6" responsiveLayout="scroll">
                <ng-template #header>
                    <tr><th>Fecha</th><th>Venta</th><th>Monto</th><th>Método</th></tr>
                </ng-template>
                <ng-template #body let-c>
                    <tr>
                        <td>{{ formatFecha(c.fecha) }}</td>
                        <td>#{{ c.id_venta }}</td>
                        <td>{{ formatBs(c.monto) }}</td>
                        <td>{{ etiquetaPago(c) }}</td>
                    </tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr><td colspan="4"><div class="text-center py-4 text-muted-color">Sin cobranzas.</div></td></tr>
                </ng-template>
            </p-table>
            <ng-template #footer>
                <p-button label="Cerrar" severity="secondary" [outlined]="true" (onClick)="dialogExtracto = false" />
            </ng-template>
        </p-dialog>
    `
})
export class ClientesPage implements OnInit {
    filasTabla = FILAS_TABLA;
    filtrarTabla = filtrarTabla;
    clientes: Cliente[] = [];
    cargando = false;
    guardando = false;
    dialog = false;
    dialogExtracto = false;
    form: Cliente = this.vacio();
    extractoCliente: Cliente | null = null;
    extractoVentas: Venta[] = [];
    extractoCobranzas: Cobranza[] = [];
    itemsAcciones: MenuItem[] = [];
    formatBs = formatBs;
    formatFecha = formatFecha;
    etiquetaPago = etiquetaPago;

    constructor(private clientesService: ClientesService, private ventasService: VentasService, private aviso: AvisoService) {}

    ngOnInit(): void {
        this.cargar();
    }

    cargar(): void {
        this.cargando = true;
        this.clientesService.listar({ activos: 'todos' }).subscribe({
            next: (data) => {
                this.clientes = data;
                this.cargando = false;
            },
            error: (err) => {
                this.cargando = false;
                this.aviso.error(err, 'No se pudo cargar clientes');
            }
        });
    }

    abrirNuevo(): void {
        this.form = this.vacio();
        this.dialog = true;
    }

    abrirAcciones(event: Event, menu: Menu, cli: Cliente): void {
        this.itemsAcciones = [
            {
                label: 'Cuenta del cliente',
                icon: 'pi pi-book menu-icon-ver',
                iconStyle: { color: '#3b82f6' },
                command: () => this.verExtracto(cli)
            },
            {
                label: 'Editar',
                icon: 'pi pi-pencil menu-icon-editar',
                iconStyle: { color: '#f59e0b' },
                command: () => this.editar(cli)
            }
        ];
        menu.toggle(event);
    }

    editar(cli: Cliente): void {
        this.form = { ...cli };
        this.dialog = true;
    }

    verExtracto(cli: Cliente): void {
        this.extractoCliente = cli;
        this.extractoVentas = [];
        this.extractoCobranzas = [];
        this.dialogExtracto = true;
        forkJoin({
            vigentes: this.ventasService.listar({ id_cliente: cli.id }),
            anuladas: this.ventasService.listar({ id_cliente: cli.id, estado: 'ANULADA' }),
            cobranzas: this.ventasService.listarCobranzas({ id_cliente: cli.id })
        }).subscribe({
            next: ({ vigentes, anuladas, cobranzas }) => {
                this.extractoVentas = [...vigentes, ...anuladas].sort((a, b) => Number(b.id) - Number(a.id));
                this.extractoCobranzas = cobranzas;
            }
        });
    }

    get extractoTotal(): number {
        return this.extractoVentas.filter((v) => v.estado !== 'ANULADA').reduce((acc, v) => acc + Number(v.total || 0), 0);
    }

    get extractoCobrado(): number {
        return this.extractoVentas.filter((v) => v.estado !== 'ANULADA').reduce((acc, v) => acc + Number(v.pagado || 0), 0);
    }

    get extractoPendiente(): number {
        return this.extractoVentas.filter((v) => v.estado === 'PENDIENTE' || v.estado === 'PARCIAL').reduce((acc, v) => acc + Number(v.saldo_pendiente || 0), 0);
    }

    guardar(): void {
        if (!this.form.nombre?.trim()) {
            this.aviso.aviso('Validación', 'El nombre es obligatorio');
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
                this.aviso.ok('Listo', res.mensaje);
                this.cargar();
            },
            error: (err) => {
                this.guardando = false;
                this.aviso.error(err, 'No se pudo guardar');
            }
        });
    }

    private vacio(): Cliente {
        return { id: 0, nombre: '', nit_ci: '', telefono: '', direccion: '', observacion: '', activo: true, path_imagen: imagenDefault('cliente') };
    }

    foto(path?: string | null): string {
        return mediaUrl(path, 'cliente');
    }
}
