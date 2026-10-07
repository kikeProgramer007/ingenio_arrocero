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
import { Proveedor, CuentaProveedor } from './compras.models';
import { ProveedoresService } from './compras.service';
import { ImagenCampoComponent } from '../../shared/components/imagen-campo';
import { TablaEsqueletoComponent } from '../../shared/components/tabla-esqueleto';
import { AyudaCampoComponent } from '../../shared/components/ayuda-campo';
import { TooltipModule } from 'primeng/tooltip';
import { Menu, MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { imagenDefault, mediaUrl } from '../../core/utils/media-url';
import { TablaBusquedaComponent } from '../../shared/components/tabla-busqueda';
import { FILAS_TABLA, filtrarTabla } from '../../shared/utils/tabla';
import { formatBs, formatFecha } from '../caja/caja.utils';
import { BotonesExportarComponent } from '../../shared/components/botones-exportar';

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
        TooltipModule,
        MenuModule,
        TablaBusquedaComponent,
        BotonesExportarComponent
    ],
    template: `
        <p-menu #menuAcciones [popup]="true" [model]="itemsAcciones" [appendTo]="'body'" [baseZIndex]="1200" />
        <div class="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div class="min-w-0">
                <div class="text-surface-900 dark:text-surface-0 font-semibold text-2xl mb-1">Proveedores</div>
                <div class="text-muted-color">Quienes venden arroz en chala, insumos y servicios</div>
            </div>
            <p-button label="Nuevo proveedor" icon="pi pi-plus" (onClick)="abrirNuevo()" />
        </div>

        <div class="card">
            <div class="flex flex-wrap items-end gap-3 mb-4">
                <div class="w-full lg:w-[18rem] min-w-0 lg:ml-auto">
                    <label class="block font-bold mb-1 text-sm">Buscar</label>
                    <app-tabla-busqueda placeholder="Buscar por nombre o NIT/CI" (buscar)="filtrarTabla(dt, $event)" />
                </div>
            </div>
            <p-table
                #dt
                [value]="cargando ? [] : proveedores"
                [loading]="cargando"
                [showLoader]="false"
                [paginator]="true"
                [alwaysShowPaginator]="true"
                [rows]="10"
                [rowsPerPageOptions]="filasTabla"
                [showCurrentPageReport]="true"
                currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} proveedores"
                [globalFilterFields]="['nombre', 'nit_ci', 'telefono', 'direccion']"
                [rowHover]="true"
                sortMode="single"
                responsiveLayout="scroll"
            >
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
                        <td>
                            <p-button
                                icon="pi pi-ellipsis-v"
                                [rounded]="true"
                                [text]="true"
                                severity="secondary"
                                pTooltip="Opciones"
                                tooltipPosition="left"
                                ariaLabel="Opciones del proveedor"
                                (onClick)="abrirAcciones($event, menuAcciones, item)"
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

        <p-dialog header="Cuenta de {{ cuenta?.proveedor?.nombre }}" [(visible)]="dialogCuenta" [modal]="true" [style]="{ width: '72rem' }" [breakpoints]="{ '960px': '95vw' }">
            <div class="grid grid-cols-12 gap-3 mb-4" *ngIf="cuenta">
                <div class="col-span-4">
                    <div class="text-muted-color">Cargo</div>
                    <div class="font-semibold text-xl">{{ formatBs(cuenta.resumen.cargo) }}</div>
                    <div class="text-muted-color text-xs">Compras {{ formatBs(cuenta.resumen.compras) }} · Servicios {{ formatBs(cuenta.resumen.servicios) }} · Acopio {{ formatBs(cuenta.resumen.acopios) }}</div>
                </div>
                <div class="col-span-4">
                    <div class="text-muted-color">Abonado</div>
                    <div class="font-semibold text-xl text-green-600">{{ formatBs(cuenta.resumen.abono) }}</div>
                    <div class="text-muted-color text-xs">Pagos {{ formatBs(cuenta.resumen.pagado_compras) }} · Acopio {{ formatBs(cuenta.resumen.pagado_acopios) }}</div>
                </div>
                <div class="col-span-4">
                    <div class="text-muted-color">Saldo por pagar</div>
                    <div class="font-semibold text-xl text-orange-500">{{ formatBs(cuenta.resumen.saldo) }}</div>
                </div>
            </div>
            <p class="text-muted-color text-sm mb-2">Lo que este productor entregó (compra + acopio). El stock del almacén es único: no se reserva ni se descuenta el pilado por productor.</p>
            <p-table [value]="cuenta?.inventario || []" [paginator]="(cuenta?.inventario?.length || 0) > 5" [rows]="5" responsiveLayout="scroll" styleClass="mb-4">
                <ng-template #header>
                    <tr><th>Producto</th><th>Unidad</th><th>Compras</th><th>Acopio</th><th>Entregado</th></tr>
                </ng-template>
                <ng-template #body let-i>
                    <tr>
                        <td>{{ i.producto }}</td>
                        <td>{{ i.unidad }}</td>
                        <td>{{ formatCantidad(i.compras) }}</td>
                        <td>{{ formatCantidad(i.acopio) }}</td>
                        <td class="font-medium">{{ formatCantidad(i.entregado) }}</td>
                    </tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr><td colspan="5"><div class="text-center py-3 text-muted-color">Sin entregas de inventario. Un servicio (compra sin producto) no suma kilos.</div></td></tr>
                </ng-template>
            </p-table>
            <p class="text-muted-color text-sm mb-3">Kardex de la cuenta: cada fila es una compra, un servicio o un pago. Boleta, chofer y placa van en la entrega de chala, no en el pago.</p>
            <p-table [value]="cuenta?.kardex || []" [paginator]="true" [alwaysShowPaginator]="true" [rows]="8" sortMode="single" responsiveLayout="scroll">
                <ng-template #header>
                    <tr>
                        <th>Fecha</th>
                        <th>Tipo</th>
                        <th>Concepto</th>
                        <th>Boleta</th>
                        <th>Chofer</th>
                        <th>Placa</th>
                        <th>Fanegas</th>
                        <th>Precio</th>
                        <th>Compra</th>
                        <th>Pagos</th>
                        <th>Saldo</th>
                    </tr>
                </ng-template>
                <ng-template #body let-l>
                    <tr>
                        <td>{{ formatFecha(l.fecha) }}</td>
                        <td><p-tag [value]="l.tipo" [severity]="severidadKardex(l.tipo)" /></td>
                        <td>{{ l.detalle }}</td>
                        <td>{{ l.boleta || '-' }}</td>
                        <td>{{ l.chofer || '-' }}</td>
                        <td>{{ l.placa || '-' }}</td>
                        <td>{{ l.fanegas ? formatCantidad(l.fanegas) : '-' }}</td>
                        <td>{{ l.precio ? formatBs(l.precio) : '-' }}</td>
                        <td>{{ l.cargo ? formatBs(l.cargo) : '-' }}</td>
                        <td>{{ l.abono ? formatBs(l.abono) : '-' }}</td>
                        <td class="font-medium">{{ formatBs(l.saldo) }}</td>
                    </tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr><td colspan="11"><div class="text-center py-4 text-muted-color">Sin movimientos. Las compras, pagos y acopios de este productor aparecen aquí.</div></td></tr>
                </ng-template>
            </p-table>
            <ng-template #footer>
                <app-botones-exportar *ngIf="cuenta?.proveedor?.id" tipo="cuenta_proveedor" [id]="cuenta?.proveedor?.id" />
                <p-button label="Cerrar" severity="secondary" [outlined]="true" (onClick)="dialogCuenta = false" />
            </ng-template>
        </p-dialog>
    `
})
export class ProveedoresPage implements OnInit {
    filasTabla = FILAS_TABLA;
    filtrarTabla = filtrarTabla;
    proveedores: Proveedor[] = [];
    cargando = false;
    guardando = false;
    dialog = false;
    dialogCuenta = false;
    form: Proveedor = this.vacio();
    cuenta: CuentaProveedor | null = null;
    itemsAcciones: MenuItem[] = [];
    formatBs = formatBs;
    formatFecha = formatFecha;

    constructor(private proveedoresService: ProveedoresService, private aviso: AvisoService) {}

    ngOnInit(): void {
        this.cargar();
    }

    cargar(): void {
        this.cargando = true;
        this.proveedoresService.listar({ activos: 'todos' }).subscribe({
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

    abrirAcciones(event: Event, menu: Menu, item: Proveedor): void {
        this.itemsAcciones = [
            {
                label: 'Cuenta del productor',
                icon: 'pi pi-book menu-icon-ver',
                iconStyle: { color: '#3b82f6' },
                command: () => this.verCuenta(item)
            },
            {
                label: 'Editar',
                icon: 'pi pi-pencil menu-icon-editar',
                iconStyle: { color: '#f59e0b' },
                command: () => this.editar(item)
            }
        ];
        menu.toggle(event);
    }

    editar(item: Proveedor): void {
        this.form = { ...item };
        this.dialog = true;
    }

    verCuenta(item: Proveedor): void {
        this.cuenta = null;
        this.dialogCuenta = true;
        this.proveedoresService.cuenta(item.id).subscribe({
            next: (data) => {
                this.cuenta = data;
            },
            error: (err) => {
                this.dialogCuenta = false;
                this.aviso.error(err, 'No se pudo cargar la cuenta del productor');
            }
        });
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

    formatCantidad(valor: number): string {
        return Number(valor || 0).toLocaleString('es-BO', { maximumFractionDigits: 3 });
    }

    severidadKardex(tipo: string): 'success' | 'warn' | 'info' | 'secondary' {
        if (tipo === 'PAGO' || tipo === 'PAGO ACOPIO') return 'success';
        if (tipo === 'ACOPIO') return 'info';
        if (tipo === 'SERVICIO') return 'secondary';
        return 'warn';
    }
}
